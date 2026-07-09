package app.wifisoundthing.core

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AudioPacketCodecTest {

    @Test
    fun `encode then decode round-trips all fields`() {
        val payload = ByteArray(321) { (it * 7).toByte() }
        val bytes = AudioPacketCodec.encode(seq = 12345L, ptsUs = 987_654_321L, payload = payload)
        val packet = AudioPacketCodec.decode(bytes)!!
        assertEquals(12345L, packet.seq)
        assertEquals(987_654_321L, packet.ptsUs)
        assertArrayEquals(payload, packet.payload)
    }

    @Test
    fun `sequence numbers survive the unsigned 32-bit boundary`() {
        val bigSeq = 0xFFFF_FFF0L
        val packet = AudioPacketCodec.decode(AudioPacketCodec.encode(bigSeq, 0L, byteArrayOf(1)))!!
        assertEquals(bigSeq, packet.seq)
    }

    @Test
    fun `empty payload is valid`() {
        val packet = AudioPacketCodec.decode(AudioPacketCodec.encode(1L, 2L, ByteArray(0)))!!
        assertEquals(0, packet.payload.size)
    }

    @Test
    fun `decode respects explicit length shorter than the array`() {
        val payload = ByteArray(100) { it.toByte() }
        val bytes = AudioPacketCodec.encode(7L, 8L, payload)
        val padded = bytes + ByteArray(50) // simulate a reused datagram buffer
        val packet = AudioPacketCodec.decode(padded, bytes.size)!!
        assertArrayEquals(payload, packet.payload)
    }

    @Test
    fun `garbage and truncated datagrams are rejected, not thrown`() {
        assertNull(AudioPacketCodec.decode(ByteArray(0)))
        assertNull(AudioPacketCodec.decode(ByteArray(5)))
        assertNull(AudioPacketCodec.decode(ByteArray(64) { 0x42 })) // wrong magic
        val wrongVersion = AudioPacketCodec.encode(1L, 1L, byteArrayOf(1)).also { it[2] = 99 }
        assertNull(AudioPacketCodec.decode(wrongVersion))
        val wrongType = AudioPacketCodec.encode(1L, 1L, byteArrayOf(1)).also { it[3] = 9 }
        assertNull(AudioPacketCodec.decode(wrongType))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `oversized payload is refused at encode time`() {
        AudioPacketCodec.encode(1L, 1L, ByteArray(Protocol.MAX_AUDIO_PAYLOAD + 1))
    }
}
