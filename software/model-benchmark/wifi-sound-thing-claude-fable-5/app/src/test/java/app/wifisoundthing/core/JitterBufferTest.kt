package app.wifisoundthing.core

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class JitterBufferTest {

    private fun packet(seq: Long) = AudioPacket(seq, seq * 21_333, byteArrayOf(seq.toByte()))

    private fun frameSeqOf(event: JitterBuffer.Event): Long {
        val frame = event as JitterBuffer.Event.Frame
        return frame.payload[0].toLong()
    }

    @Test
    fun `buffers until target depth then plays in order`() {
        val buffer = JitterBuffer(targetDepth = 3)
        assertTrue(buffer.poll() is JitterBuffer.Event.Buffering)
        buffer.put(packet(10))
        buffer.put(packet(11))
        assertTrue(buffer.poll() is JitterBuffer.Event.Buffering)
        buffer.put(packet(12))
        assertEquals(10L, frameSeqOf(buffer.poll()))
        assertEquals(11L, frameSeqOf(buffer.poll()))
        assertEquals(12L, frameSeqOf(buffer.poll()))
    }

    @Test
    fun `reordered packets play in sequence order`() {
        val buffer = JitterBuffer(targetDepth = 3)
        buffer.put(packet(2))
        buffer.put(packet(0))
        buffer.put(packet(1))
        assertEquals(0L, frameSeqOf(buffer.poll()))
        assertEquals(1L, frameSeqOf(buffer.poll()))
        assertEquals(2L, frameSeqOf(buffer.poll()))
    }

    @Test
    fun `lost packet becomes a gap and playback continues`() {
        val buffer = JitterBuffer(targetDepth = 3)
        buffer.put(packet(0))
        buffer.put(packet(2)) // 1 lost
        buffer.put(packet(3))
        assertEquals(0L, frameSeqOf(buffer.poll()))
        assertTrue(buffer.poll() is JitterBuffer.Event.Gap)
        assertEquals(2L, frameSeqOf(buffer.poll()))
        assertEquals(3L, frameSeqOf(buffer.poll()))
        assertEquals(1L, buffer.gaps)
    }

    @Test
    fun `duplicates are dropped and counted`() {
        val buffer = JitterBuffer(targetDepth = 2)
        buffer.put(packet(0))
        buffer.put(packet(0))
        buffer.put(packet(1))
        assertEquals(1L, buffer.duplicates)
        assertEquals(0L, frameSeqOf(buffer.poll()))
        assertEquals(1L, frameSeqOf(buffer.poll()))
    }

    @Test
    fun `packets arriving after their slot played are counted late and dropped`() {
        val buffer = JitterBuffer(targetDepth = 2)
        buffer.put(packet(0))
        buffer.put(packet(1))
        buffer.poll() // plays 0
        buffer.put(packet(0)) // straggler
        assertEquals(1L, buffer.late)
        assertEquals(1L, frameSeqOf(buffer.poll()))
    }

    @Test
    fun `underrun switches back to buffering and recovers`() {
        val buffer = JitterBuffer(targetDepth = 2)
        buffer.put(packet(0))
        buffer.put(packet(1))
        assertEquals(0L, frameSeqOf(buffer.poll()))
        assertEquals(1L, frameSeqOf(buffer.poll()))
        assertTrue(buffer.poll() is JitterBuffer.Event.Buffering)
        assertEquals(1L, buffer.underruns)
        // stream resumes at a later position
        buffer.put(packet(50))
        assertTrue(buffer.poll() is JitterBuffer.Event.Buffering) // still refilling
        buffer.put(packet(51))
        assertEquals(50L, frameSeqOf(buffer.poll()))
        assertEquals(51L, frameSeqOf(buffer.poll()))
    }

    @Test
    fun `overfull buffer skips ahead to bound latency`() {
        val buffer = JitterBuffer(targetDepth = 2, maxDepth = 5)
        for (seq in 0L..9L) buffer.put(packet(seq))
        assertTrue(buffer.latencySkips > 0)
        // After skipping, the next played frame is recent, not seq 0.
        val first = frameSeqOf(buffer.poll())
        assertTrue("expected a recent frame, got $first", first >= 8L)
    }

    @Test
    fun `payload integrity is preserved`() {
        val buffer = JitterBuffer(targetDepth = 1)
        val payload = ByteArray(300) { (it % 251).toByte() }
        buffer.put(AudioPacket(5, 123, payload))
        val frame = buffer.poll() as JitterBuffer.Event.Frame
        assertArrayEquals(payload, frame.payload)
        assertEquals(123L, frame.ptsUs)
    }

    @Test
    fun `loss ratio reflects gaps`() {
        val buffer = JitterBuffer(targetDepth = 1)
        buffer.put(packet(0))
        buffer.put(packet(2))
        buffer.put(packet(3))
        repeat(4) { buffer.poll() } // 0, gap, 2, 3
        assertEquals(0.25, buffer.lossRatio, 1e-9)
    }

    @Test
    fun `reset returns to initial state`() {
        val buffer = JitterBuffer(targetDepth = 2)
        buffer.put(packet(0))
        buffer.put(packet(1))
        buffer.poll()
        buffer.reset()
        assertEquals(0, buffer.depth)
        assertTrue(buffer.poll() is JitterBuffer.Event.Buffering)
        // after reset, old sequence numbers are accepted again
        buffer.put(packet(0))
        buffer.put(packet(1))
        assertEquals(0L, frameSeqOf(buffer.poll()))
    }
}
