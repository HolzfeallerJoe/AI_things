package com.wifisoundthing.claudeopus46.audio

import org.junit.Assert.*
import org.junit.Test

class AudioPacketTest {

    @Test
    fun headerSize_is15() {
        assertEquals(15, AudioPacket.HEADER_SIZE)
    }

    @Test
    fun serialize_deserialize_roundtrip() {
        val payload = byteArrayOf(1, 2, 3, 4, 5, 6, 7, 8)
        val original = AudioPacket(
            sequenceNumber = 42,
            timestampUs = 1_234_567_890L,
            codecId = 0,
            payload = payload
        )

        val bytes = AudioPacket.serialize(original)
        val restored = AudioPacket.deserialize(bytes)

        assertNotNull(restored)
        assertEquals(original.sequenceNumber, restored!!.sequenceNumber)
        assertEquals(original.timestampUs, restored.timestampUs)
        assertEquals(original.codecId, restored.codecId)
        assertArrayEquals(original.payload, restored.payload)
    }

    @Test
    fun serialize_correctTotalSize() {
        val payload = ByteArray(100)
        val packet = AudioPacket(0, 0L, 0, payload)
        val bytes = AudioPacket.serialize(packet)
        assertEquals(AudioPacket.HEADER_SIZE + 100, bytes.size)
    }

    @Test
    fun serialize_emptyPayload() {
        val packet = AudioPacket(1, 999L, 1, byteArrayOf())
        val bytes = AudioPacket.serialize(packet)
        assertEquals(AudioPacket.HEADER_SIZE, bytes.size)

        val restored = AudioPacket.deserialize(bytes)
        assertNotNull(restored)
        assertEquals(0, restored!!.payload.size)
    }

    @Test
    fun deserialize_returnsNull_forTruncatedData() {
        val tooShort = ByteArray(10) // less than HEADER_SIZE
        assertNull(AudioPacket.deserialize(tooShort))
    }

    @Test
    fun deserialize_returnsNull_forEmptyArray() {
        assertNull(AudioPacket.deserialize(byteArrayOf()))
    }

    @Test
    fun deserialize_returnsNull_whenPayloadLengthExceedsData() {
        // Create a valid header claiming 100 bytes of payload, but only provide 5
        val payload = byteArrayOf(1, 2, 3, 4, 5)
        val packet = AudioPacket(0, 0L, 0, ByteArray(100))
        val fullBytes = AudioPacket.serialize(packet)
        // Truncate to header + 5 bytes instead of header + 100
        val truncated = fullBytes.copyOf(AudioPacket.HEADER_SIZE + 5)
        assertNull(AudioPacket.deserialize(truncated))
    }

    @Test
    fun sequenceNumber_preservedAtBoundaries() {
        val maxSeq = AudioPacket(Int.MAX_VALUE, 0L, 0, byteArrayOf())
        val bytes = AudioPacket.serialize(maxSeq)
        val restored = AudioPacket.deserialize(bytes)
        assertEquals(Int.MAX_VALUE, restored!!.sequenceNumber)
    }

    @Test
    fun timestamp_preservedAtBoundaries() {
        val maxTs = AudioPacket(0, Long.MAX_VALUE, 0, byteArrayOf())
        val bytes = AudioPacket.serialize(maxTs)
        val restored = AudioPacket.deserialize(bytes)
        assertEquals(Long.MAX_VALUE, restored!!.timestampUs)
    }

    @Test
    fun codecId_preserved() {
        for (id in listOf<Byte>(0, 1, 2, 127)) {
            val packet = AudioPacket(0, 0L, id, byteArrayOf(42))
            val restored = AudioPacket.deserialize(AudioPacket.serialize(packet))
            assertEquals(id, restored!!.codecId)
        }
    }

    @Test
    fun largePayload_roundtrip() {
        val payload = ByteArray(3840) { (it % 256).toByte() }
        val packet = AudioPacket(999, 5_000_000L, 0, payload)
        val restored = AudioPacket.deserialize(AudioPacket.serialize(packet))

        assertNotNull(restored)
        assertEquals(999, restored!!.sequenceNumber)
        assertEquals(5_000_000L, restored.timestampUs)
        assertArrayEquals(payload, restored.payload)
    }

    @Test
    fun equals_sameContent() {
        val a = AudioPacket(1, 2L, 0, byteArrayOf(3, 4))
        val b = AudioPacket(1, 2L, 0, byteArrayOf(3, 4))
        assertEquals(a, b)
        assertEquals(a.hashCode(), b.hashCode())
    }

    @Test
    fun equals_differentPayload() {
        val a = AudioPacket(1, 2L, 0, byteArrayOf(3, 4))
        val b = AudioPacket(1, 2L, 0, byteArrayOf(5, 6))
        assertNotEquals(a, b)
    }
}
