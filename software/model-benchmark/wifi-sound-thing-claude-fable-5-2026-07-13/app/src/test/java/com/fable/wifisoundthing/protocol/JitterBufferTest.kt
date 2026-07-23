package com.fable.wifisoundthing.protocol

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class JitterBufferTest {

    private fun payload(n: Int) = byteArrayOf(n.toByte())

    private fun popSeq(buffer: JitterBuffer): Int {
        val result = buffer.pop()
        assertTrue("expected Packet but was $result", result is JitterBuffer.PopResult.Packet)
        return (result as JitterBuffer.PopResult.Packet).seq
    }

    @Test
    fun `waits until prebuffer is filled, then plays in order`() {
        val buffer = JitterBuffer(prebufferPackets = 3)
        assertEquals(JitterBuffer.PopResult.Waiting, buffer.pop())

        buffer.push(10, payload(10))
        buffer.push(11, payload(11))
        assertEquals(JitterBuffer.PopResult.Waiting, buffer.pop())

        buffer.push(12, payload(12))
        assertEquals(10, popSeq(buffer))
        assertEquals(11, popSeq(buffer))
        assertEquals(12, popSeq(buffer))
    }

    @Test
    fun `reordered packets play in sequence order`() {
        val buffer = JitterBuffer(prebufferPackets = 2)
        buffer.push(0, payload(0))
        buffer.push(2, payload(2)) // arrives before 1
        buffer.push(1, payload(1))

        assertEquals(0, popSeq(buffer))
        assertEquals(1, popSeq(buffer))
        assertEquals(2, popSeq(buffer))
    }

    @Test
    fun `lost packet is reported as Missing after the reorder window passes`() {
        val buffer = JitterBuffer(prebufferPackets = 2, reorderWindow = 2)
        buffer.push(0, payload(0))
        buffer.push(1, payload(1))
        assertEquals(0, popSeq(buffer))
        assertEquals(1, popSeq(buffer))

        // Packet 2 never arrives; 3 and 4 do.
        buffer.push(3, payload(3))
        buffer.push(4, payload(4))
        assertEquals(JitterBuffer.PopResult.Missing, buffer.pop())
        assertEquals(3, popSeq(buffer))
        assertEquals(4, popSeq(buffer))
        assertEquals(1, buffer.stats().lost)
    }

    @Test
    fun `waits for a possibly-reordered packet within the window`() {
        val buffer = JitterBuffer(prebufferPackets = 1, reorderWindow = 2)
        buffer.push(0, payload(0))
        assertEquals(0, popSeq(buffer))
        buffer.push(2, payload(2)) // only one ahead: could still be reordering
        assertEquals(JitterBuffer.PopResult.Waiting, buffer.pop())
        buffer.push(1, payload(1))
        assertEquals(1, popSeq(buffer))
        assertEquals(2, popSeq(buffer))
    }

    @Test
    fun `duplicates and stale packets are ignored`() {
        val buffer = JitterBuffer(prebufferPackets = 1)
        buffer.push(5, payload(5))
        assertEquals(5, popSeq(buffer))
        buffer.push(5, payload(5)) // already played
        buffer.push(4, payload(4)) // older than the playhead
        assertEquals(JitterBuffer.PopResult.Waiting, buffer.pop())
        assertEquals(2, buffer.stats().late)
    }

    @Test
    fun `deep backlog is skipped to restore target latency`() {
        val buffer = JitterBuffer(prebufferPackets = 2, maxDepthPackets = 10)
        for (seq in 0 until 30) buffer.push(seq, payload(seq))
        // The first pop should have jumped close to the freshest packets.
        val first = popSeq(buffer)
        assertTrue("expected skip ahead, but played $first", first >= 28)
        assertTrue(buffer.stats().overflowDropped > 0)
    }

    @Test
    fun `large sequence jump resets the stream`() {
        val buffer = JitterBuffer(prebufferPackets = 1)
        buffer.push(0, payload(0))
        assertEquals(0, popSeq(buffer))

        buffer.push(500_000, payload(1)) // host restarted
        assertEquals(1, buffer.stats().resets)
        assertEquals(500_000, popSeq(buffer))
    }

    @Test
    fun `underrun re-enters buffering instead of stuttering packet by packet`() {
        val buffer = JitterBuffer(prebufferPackets = 3)
        for (seq in 0 until 3) buffer.push(seq, payload(seq))
        for (seq in 0 until 3) assertEquals(seq, popSeq(buffer))

        // Stream stalls, then a single packet trickles in: keep buffering.
        assertEquals(JitterBuffer.PopResult.Waiting, buffer.pop())
        buffer.push(3, payload(3))
        assertEquals(JitterBuffer.PopResult.Waiting, buffer.pop())
        buffer.push(4, payload(4))
        buffer.push(5, payload(5))
        assertEquals(3, popSeq(buffer))
    }

    @Test
    fun `sequence numbers survive 32-bit wraparound`() {
        val buffer = JitterBuffer(prebufferPackets = 2)
        var seq = Int.MAX_VALUE - 2
        repeat(6) {
            buffer.push(seq, payload(it))
            seq += 1 // wraps to Int.MIN_VALUE
        }
        var expected = Int.MAX_VALUE - 2
        repeat(6) {
            assertEquals(expected, popSeq(buffer))
            expected += 1
        }
        assertEquals(0, buffer.stats().resets)
    }

    @Test
    fun `payload contents are preserved`() {
        val buffer = JitterBuffer(prebufferPackets = 1)
        val data = byteArrayOf(9, 8, 7)
        buffer.push(0, data)
        val result = buffer.pop() as JitterBuffer.PopResult.Packet
        assertArrayEquals(data, result.payload)
    }
}
