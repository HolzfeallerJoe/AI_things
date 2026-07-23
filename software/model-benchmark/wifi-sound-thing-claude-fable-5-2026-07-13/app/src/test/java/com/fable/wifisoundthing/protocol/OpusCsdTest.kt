package com.fable.wifisoundthing.protocol

import java.nio.ByteBuffer
import java.nio.ByteOrder
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class OpusCsdTest {

    @Test
    fun `default OpusHead has the documented layout`() {
        val head = OpusCsd.defaultOpusHead(channels = 2, sampleRate = 48_000)
        assertEquals(19, head.size)
        assertEquals("OpusHead", String(head, 0, 8, Charsets.US_ASCII))
        assertEquals(1, head[8].toInt()) // version
        assertEquals(2, head[9].toInt()) // channels
        val buf = ByteBuffer.wrap(head).order(ByteOrder.LITTLE_ENDIAN)
        assertEquals(3840, buf.getShort(10).toInt()) // pre-skip
        assertEquals(48_000, buf.getInt(12)) // input sample rate
        assertEquals(0, buf.getShort(16).toInt()) // output gain
        assertEquals(0, head[18].toInt()) // mapping family
    }

    @Test
    fun `bare OpusHead passes through extraction`() {
        val head = OpusCsd.defaultOpusHead(2, 48_000)
        assertArrayEquals(head, OpusCsd.extractOpusHead(head))
    }

    @Test
    fun `AOPUS-wrapped csd is unwrapped`() {
        val head = OpusCsd.defaultOpusHead(2, 48_000)
        val wrapped = ByteBuffer.allocate(8 + 8 + head.size + 8 + 8 + 8)
            .order(ByteOrder.LITTLE_ENDIAN)
            .put("AOPUSHDR".toByteArray(Charsets.US_ASCII))
            .putLong(head.size.toLong())
            .put(head)
            .put("AOPUSDLY".toByteArray(Charsets.US_ASCII))
            .putLong(8L)
            .putLong(80_000_000L)
            .array()
        assertArrayEquals(head, OpusCsd.extractOpusHead(wrapped))
    }

    @Test
    fun `unrecognized csd returns null`() {
        assertNull(OpusCsd.extractOpusHead(ByteArray(4)))
        assertNull(OpusCsd.extractOpusHead("GARBAGE-".toByteArray() + ByteArray(16)))
        // Truncated AOPUS block (claims more bytes than present).
        val truncated = ByteBuffer.allocate(16).order(ByteOrder.LITTLE_ENDIAN)
            .put("AOPUSHDR".toByteArray(Charsets.US_ASCII))
            .putLong(1000L)
            .array()
        assertNull(OpusCsd.extractOpusHead(truncated))
    }

    @Test
    fun `pre-skip is read from the header`() {
        val head = OpusCsd.defaultOpusHead(2, 48_000, preSkipSamples = 312)
        assertEquals(312, OpusCsd.preSkipSamples(head))
    }

    @Test
    fun `decoder csd carries pre-skip and pre-roll in nanoseconds`() {
        val head = OpusCsd.defaultOpusHead(2, 48_000) // pre-skip 3840 samples = 80 ms
        val csd = OpusCsd.decoderCsd(head, 48_000)
        assertArrayEquals(head, csd[0])
        assertEquals(
            80_000_000L,
            ByteBuffer.wrap(csd[1]).order(ByteOrder.LITTLE_ENDIAN).long,
        )
        assertEquals(
            OpusCsd.DEFAULT_SEEK_PREROLL_NS,
            ByteBuffer.wrap(csd[2]).order(ByteOrder.LITTLE_ENDIAN).long,
        )
    }
}
