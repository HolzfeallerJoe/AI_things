package app.wifisoundthing.core

import org.junit.Assert.assertEquals
import org.junit.Test

class RateMeterTest {

    @Test
    fun `total bytes accumulate`() {
        val meter = RateMeter()
        meter.record(0, 100)
        meter.record(10, 250)
        assertEquals(350L, meter.totalBytes)
    }

    @Test
    fun `bitrate reflects the rolling window`() {
        val meter = RateMeter(windowMs = 1000)
        meter.record(0, 1000)
        meter.record(500, 1000)
        // 2000 bytes over 1000ms window span (0..1000) = 16000 bits/s
        assertEquals(16_000L, meter.bitsPerSecond(1000))
    }

    @Test
    fun `old samples fall out of the window`() {
        val meter = RateMeter(windowMs = 1000)
        meter.record(0, 1_000_000)
        meter.record(5000, 1000)
        // Only the second sample remains; span clamps to >= 1ms.
        val bps = meter.bitsPerSecond(5001)
        assertEquals(1000 * 8 * 1000L / 1, bps)
        assertEquals(1_001_000L, meter.totalBytes) // total is lifetime, not windowed
    }

    @Test
    fun `empty meter reports zero`() {
        assertEquals(0L, RateMeter().bitsPerSecond(123456))
    }

    @Test
    fun `reset clears everything`() {
        val meter = RateMeter()
        meter.record(0, 5000)
        meter.reset()
        assertEquals(0L, meter.totalBytes)
        assertEquals(0L, meter.bitsPerSecond(1))
    }
}
