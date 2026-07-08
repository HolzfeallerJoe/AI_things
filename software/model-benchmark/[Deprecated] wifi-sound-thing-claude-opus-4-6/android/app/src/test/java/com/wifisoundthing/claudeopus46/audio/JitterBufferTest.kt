package com.wifisoundthing.claudeopus46.audio

import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

class JitterBufferTest {

    private val frameSize = 8 // small frame for tests
    private val depth = 3
    private lateinit var buffer: JitterBuffer

    @Before
    fun setUp() {
        buffer = JitterBuffer(depth, frameSize)
    }

    private fun frame(vararg values: Byte): ByteArray {
        val data = ByteArray(frameSize)
        values.forEachIndexed { i, v -> if (i < frameSize) data[i] = v }
        return data
    }

    // ── Priming ────────────────────────────────────────────────────────

    @Test
    fun take_blocksUntilPrimed() {
        val result = AtomicReference<ByteArray?>(null)
        val latch = CountDownLatch(1)

        val reader = Thread {
            result.set(buffer.take())
            latch.countDown()
        }
        reader.start()

        // Buffer is not primed yet — reader should be blocked
        assertFalse(latch.await(100, TimeUnit.MILLISECONDS))

        // Add enough frames to prime (depth = 3)
        buffer.put(0, frame(10))
        buffer.put(1, frame(20))
        buffer.put(2, frame(30))

        // Now the reader should unblock
        assertTrue(latch.await(500, TimeUnit.MILLISECONDS))
        assertNotNull(result.get())
        assertEquals(10.toByte(), result.get()!![0])
    }

    // ── In-order delivery ──────────────────────────────────────────────

    @Test
    fun inOrderFrames_deliveredSequentially() {
        // Prime the buffer
        buffer.put(0, frame(10))
        buffer.put(1, frame(20))
        buffer.put(2, frame(30))

        val f0 = buffer.take()
        assertEquals(10.toByte(), f0[0])

        buffer.put(3, frame(40))

        val f1 = buffer.take()
        assertEquals(20.toByte(), f1[0])

        val f2 = buffer.take()
        assertEquals(30.toByte(), f2[0])

        val f3 = buffer.take()
        assertEquals(40.toByte(), f3[0])
    }

    // ── Out-of-order insertion ─────────────────────────────────────────

    @Test
    fun outOfOrderFrames_reordered() {
        buffer.put(2, frame(30))
        buffer.put(0, frame(10))
        buffer.put(1, frame(20))

        // Buffer primed (3 frames) — take should return seq 0 first
        val f0 = buffer.take()
        assertEquals(10.toByte(), f0[0])

        val f1 = buffer.take()
        assertEquals(20.toByte(), f1[0])

        val f2 = buffer.take()
        assertEquals(30.toByte(), f2[0])

        assertTrue(buffer.outOfOrderCount > 0)
    }

    // ── Gap filling ────────────────────────────────────────────────────

    @Test
    fun missingFrame_filledWithSilence() {
        // Insert 0, 1, 3 (skip 2)
        buffer.put(0, frame(10))
        buffer.put(1, frame(20))
        buffer.put(3, frame(40))

        val f0 = buffer.take()
        assertEquals(10.toByte(), f0[0])

        val f1 = buffer.take()
        assertEquals(20.toByte(), f1[0])

        // Frame 2 is missing — should get silence (all zeros)
        val f2 = buffer.take()
        assertTrue(f2.all { it == 0.toByte() })

        val f3 = buffer.take()
        assertEquals(40.toByte(), f3[0])
    }

    // ── Old frame discard ──────────────────────────────────────────────

    @Test
    fun oldFrames_discarded() {
        buffer.put(0, frame(10))
        buffer.put(1, frame(20))
        buffer.put(2, frame(30))

        // Consume first frame (nextExpected advances to 1)
        buffer.take()

        // Now insert an old frame (seq 0) — should be dropped
        val beforeDropped = buffer.packetsDropped
        buffer.put(0, frame(99))
        assertEquals(beforeDropped + 1, buffer.packetsDropped)
    }

    // ── Statistics ─────────────────────────────────────────────────────

    @Test
    fun statistics_trackCorrectly() {
        assertEquals(0L, buffer.packetsReceived)
        assertEquals(0L, buffer.packetsDropped)
        assertEquals(0L, buffer.outOfOrderCount)

        buffer.put(0, frame(1))
        buffer.put(1, frame(2))
        buffer.put(2, frame(3))

        assertEquals(3L, buffer.packetsReceived)
    }

    // ── Reset ──────────────────────────────────────────────────────────

    @Test
    fun reset_clearsAllState() {
        buffer.put(0, frame(10))
        buffer.put(1, frame(20))
        buffer.put(2, frame(30))

        buffer.reset()

        assertEquals(0L, buffer.packetsReceived)
        assertEquals(0L, buffer.packetsDropped)
        assertEquals(0L, buffer.outOfOrderCount)
        assertEquals(0, buffer.currentDepth())
        assertFalse(buffer.stopped)
    }

    // ── Stop ───────────────────────────────────────────────────────────

    @Test
    fun stop_unblocksWaitingReader() {
        val latch = CountDownLatch(1)

        val reader = Thread {
            buffer.take() // will block since buffer is not primed
            latch.countDown()
        }
        reader.start()

        // Give the reader thread time to enter wait
        Thread.sleep(50)

        buffer.stop()
        assertTrue(latch.await(500, TimeUnit.MILLISECONDS))
        assertTrue(buffer.stopped)
    }

    // ── Current depth ──────────────────────────────────────────────────

    @Test
    fun currentDepth_tracksBufferedFrames() {
        assertEquals(0, buffer.currentDepth())

        buffer.put(0, frame(10))
        assertEquals(1, buffer.currentDepth())

        buffer.put(1, frame(20))
        assertEquals(2, buffer.currentDepth())

        buffer.put(2, frame(30))
        assertEquals(3, buffer.currentDepth())

        // Consume one
        buffer.take()
        assertEquals(2, buffer.currentDepth())
    }

    // ── Overflow protection ────────────────────────────────────────────

    @Test
    fun overflowProtection_limitsBufferSize() {
        // depth=3, overflow threshold is 4*depth=12
        // Insert 15 frames without reading — old ones should be pruned
        for (i in 0 until 15) {
            buffer.put(i, frame(i.toByte()))
        }

        // Buffer should not exceed 4 * depth
        assertTrue(buffer.currentDepth() <= depth * 4)
    }
}
