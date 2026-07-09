package app.wifisoundthing.core

import java.nio.ByteBuffer

/**
 * One encoded audio frame as carried in a single UDP datagram.
 *
 * @param seq monotonically increasing sequence number (unsigned 32-bit on the wire)
 * @param ptsUs presentation timestamp in microseconds since stream start
 */
class AudioPacket(val seq: Long, val ptsUs: Long, val payload: ByteArray) {
    override fun toString(): String = "AudioPacket(seq=$seq, ptsUs=$ptsUs, ${payload.size}B)"
}

/**
 * Binary layout of a UDP audio datagram (big-endian):
 *
 * ```
 * offset  size  field
 * 0       2     magic 0x5753 ("WS")
 * 2       1     protocol version
 * 3       1     packet type (1 = audio)
 * 4       4     sequence number (u32)
 * 8       8     presentation timestamp, microseconds (u64)
 * 16      n     encoded audio frame
 * ```
 */
object AudioPacketCodec {
    const val HEADER_SIZE = 16
    const val TYPE_AUDIO = 1

    fun encode(seq: Long, ptsUs: Long, payload: ByteArray, offset: Int = 0, length: Int = payload.size): ByteArray {
        require(length in 0..Protocol.MAX_AUDIO_PAYLOAD) { "Payload too large: $length" }
        val buf = ByteBuffer.allocate(HEADER_SIZE + length)
        buf.putShort(Protocol.MAGIC.toShort())
        buf.put(Protocol.VERSION.toByte())
        buf.put(TYPE_AUDIO.toByte())
        buf.putInt((seq and 0xFFFFFFFFL).toInt())
        buf.putLong(ptsUs)
        buf.put(payload, offset, length)
        return buf.array()
    }

    /** Returns null if the datagram is not a valid audio packet. */
    fun decode(data: ByteArray, length: Int = data.size): AudioPacket? {
        if (length < HEADER_SIZE || length > HEADER_SIZE + Protocol.MAX_AUDIO_PAYLOAD) return null
        val buf = ByteBuffer.wrap(data, 0, length)
        val magic = buf.short.toInt() and 0xFFFF
        if (magic != Protocol.MAGIC) return null
        val version = buf.get().toInt() and 0xFF
        if (version != Protocol.VERSION) return null
        val type = buf.get().toInt() and 0xFF
        if (type != TYPE_AUDIO) return null
        val seq = buf.int.toLong() and 0xFFFFFFFFL
        val ptsUs = buf.long
        val payload = ByteArray(length - HEADER_SIZE)
        buf.get(payload)
        return AudioPacket(seq, ptsUs, payload)
    }
}
