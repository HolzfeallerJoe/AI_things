package com.wifisoundthing.claudeopus46.audio

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test

class PcmCodecTest {

    private val codec = PcmCodec()

    @Test
    fun codecId_isZero() {
        assertEquals(0.toByte(), codec.codecId)
    }

    @Test
    fun name_isPcm16bit() {
        assertEquals("PCM 16-bit", codec.name)
    }

    @Test
    fun encode_isIdentity() {
        val data = byteArrayOf(1, 2, 3, 4, 5)
        val encoded = codec.encode(data)
        assertArrayEquals(data, encoded)
    }

    @Test
    fun decode_isIdentity() {
        val data = byteArrayOf(10, 20, 30, 40)
        val decoded = codec.decode(data)
        assertArrayEquals(data, decoded)
    }

    @Test
    fun encode_decode_roundtrip() {
        val original = ByteArray(3840) { (it % 256).toByte() }
        val result = codec.decode(codec.encode(original))
        assertArrayEquals(original, result)
    }

    @Test
    fun encode_emptyArray() {
        val data = byteArrayOf()
        assertArrayEquals(data, codec.encode(data))
    }

    @Test
    fun release_doesNotThrow() {
        codec.release() // no-op, should not throw
    }
}
