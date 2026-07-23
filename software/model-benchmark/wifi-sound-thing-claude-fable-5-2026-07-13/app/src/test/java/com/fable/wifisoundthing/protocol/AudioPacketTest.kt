package com.fable.wifisoundthing.protocol

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AudioPacketTest {

    @Test
    fun `roundtrip preserves all fields`() {
        val payload = ByteArray(960) { (it % 251).toByte() }
        val packet = AudioPacket(Wire.CODEC_OPUS, 123456, 987654321L, payload)
        val bytes = packet.toBytes()
        val parsed = AudioPacket.parse(bytes)!!

        assertEquals(Wire.CODEC_OPUS, parsed.codec)
        assertEquals(123456, parsed.seq)
        assertEquals(987654321L, parsed.ptsUs)
        assertArrayEquals(payload, parsed.payload)
    }

    @Test
    fun `roundtrip with negative (wrapped) sequence number`() {
        val packet = AudioPacket(Wire.CODEC_PCM16, Int.MIN_VALUE + 5, 0L, ByteArray(4))
        val parsed = AudioPacket.parse(packet.toBytes())!!
        assertEquals(Int.MIN_VALUE + 5, parsed.seq)
    }

    @Test
    fun `header is exactly 16 bytes`() {
        val packet = AudioPacket(Wire.CODEC_PCM16, 0, 0L, ByteArray(100))
        assertEquals(116, packet.toBytes().size)
    }

    @Test
    fun `parse respects explicit length`() {
        val packet = AudioPacket(Wire.CODEC_PCM16, 7, 1L, byteArrayOf(1, 2, 3))
        val bytes = packet.toBytes()
        // Simulate a datagram buffer larger than the payload.
        val oversized = bytes.copyOf(bytes.size + 500)
        val parsed = AudioPacket.parse(oversized, bytes.size)!!
        assertArrayEquals(byteArrayOf(1, 2, 3), parsed.payload)
    }

    @Test
    fun `parse rejects garbage`() {
        assertNull(AudioPacket.parse(ByteArray(4))) // too short
        assertNull(AudioPacket.parse(ByteArray(32))) // wrong magic

        val badCodec = AudioPacket(Wire.CODEC_PCM16, 0, 0L, ByteArray(8)).toBytes()
        badCodec[3] = 99
        assertNull(AudioPacket.parse(badCodec))

        val badVersion = AudioPacket(Wire.CODEC_PCM16, 0, 0L, ByteArray(8)).toBytes()
        badVersion[2] = 42
        assertNull(AudioPacket.parse(badVersion))
    }
}
