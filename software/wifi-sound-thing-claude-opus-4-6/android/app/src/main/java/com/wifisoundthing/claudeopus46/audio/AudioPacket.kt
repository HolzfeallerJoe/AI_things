package com.wifisoundthing.claudeopus46.audio

import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Wire format for audio frames sent over UDP.
 *
 * Layout (big-endian):
 *   [0..3]   sequence number   (uint32)
 *   [4..11]  timestamp in µs   (uint64)
 *   [12]     codec ID           (uint8)
 *   [13..14] payload length     (uint16)
 *   [15..N]  audio payload
 *
 * Total header = 15 bytes.
 */
data class AudioPacket(
    val sequenceNumber: Int,
    val timestampUs: Long,
    val codecId: Byte,
    val payload: ByteArray
) {

    companion object {
        const val HEADER_SIZE = 15

        fun serialize(packet: AudioPacket): ByteArray {
            val buf = ByteBuffer.allocate(HEADER_SIZE + packet.payload.size)
                .order(ByteOrder.BIG_ENDIAN)
            buf.putInt(packet.sequenceNumber)
            buf.putLong(packet.timestampUs)
            buf.put(packet.codecId)
            buf.putShort(packet.payload.size.toShort())
            buf.put(packet.payload)
            return buf.array()
        }

        fun deserialize(data: ByteArray): AudioPacket? {
            if (data.size < HEADER_SIZE) return null
            val buf = ByteBuffer.wrap(data).order(ByteOrder.BIG_ENDIAN)
            val seq = buf.int
            val timestamp = buf.long
            val codec = buf.get()
            val payloadLen = buf.short.toInt() and 0xFFFF
            if (data.size < HEADER_SIZE + payloadLen) return null
            val payload = ByteArray(payloadLen)
            buf.get(payload)
            return AudioPacket(seq, timestamp, codec, payload)
        }
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is AudioPacket) return false
        return sequenceNumber == other.sequenceNumber &&
            timestampUs == other.timestampUs &&
            codecId == other.codecId &&
            payload.contentEquals(other.payload)
    }

    override fun hashCode(): Int {
        var result = sequenceNumber
        result = 31 * result + timestampUs.hashCode()
        result = 31 * result + codecId.hashCode()
        result = 31 * result + payload.contentHashCode()
        return result
    }
}
