package app.wifisoundthing.core

import org.junit.Assert.assertEquals
import org.junit.Test

class FormatTest {

    @Test
    fun `bytes formatting picks sensible units`() {
        assertEquals("512 B", Format.bytes(512))
        assertEquals("1.5 KB", Format.bytes(1536))
        assertEquals("2.0 MB", Format.bytes(2 * 1024 * 1024))
        assertEquals("1.25 GB", Format.bytes((1.25 * 1024 * 1024 * 1024).toLong()))
    }

    @Test
    fun `bitrate formatting picks sensible units`() {
        assertEquals("800 bps", Format.bitrate(800))
        assertEquals("160 kbps", Format.bitrate(160_000))
        assertEquals("1.5 Mbps", Format.bitrate(1_500_000))
    }

    @Test
    fun `durations format as clock times`() {
        assertEquals("0:00", Format.duration(0))
        assertEquals("0:59", Format.duration(59_999))
        assertEquals("2:05", Format.duration(125_000))
        assertEquals("1:00:01", Format.duration(3_601_000))
    }

    @Test
    fun `negative duration clamps to zero`() {
        assertEquals("0:00", Format.duration(-5000))
    }

    @Test
    fun `percentages format with one decimal`() {
        assertEquals("0.0%", Format.percent(0.0))
        assertEquals("2.5%", Format.percent(0.025))
        assertEquals("100.0%", Format.percent(1.0))
    }
}
