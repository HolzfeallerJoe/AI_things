package app.wifisoundthing.core

import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.IOException

/**
 * Messages exchanged on the TCP control channel.
 *
 * Frame layout (big-endian): 1 byte type, 2 bytes payload length (u16), payload.
 */
sealed class ControlMessage {

    /** Client -> host, first message after connecting. */
    data class Hello(val protocolVersion: Int, val udpPort: Int, val clientName: String) : ControlMessage()

    /** Host -> client, reply to [Hello]; carries everything needed to decode the stream. */
    data class Welcome(val sessionId: Int, val config: AudioConfig) : ControlMessage() {
        override fun equals(other: Any?): Boolean =
            other is Welcome && other.sessionId == sessionId && other.config == config
        override fun hashCode(): Int = 31 * sessionId + config.hashCode()
    }

    /** Client -> host keepalive; [timeMs] is the sender's clock, echoed back in [Pong]. */
    data class Ping(val timeMs: Long) : ControlMessage()

    /** Host -> client keepalive reply. */
    data class Pong(val timeMs: Long) : ControlMessage()

    /** Either side announces a clean shutdown. */
    object Bye : ControlMessage() {
        override fun toString(): String = "Bye"
    }

    fun encode(): ByteArray {
        val payload = ByteArrayOutputStream()
        val out = DataOutputStream(payload)
        val type: Int
        when (this) {
            is Hello -> {
                type = TYPE_HELLO
                out.writeByte(protocolVersion)
                out.writeShort(udpPort)
                out.writeUTF(clientName)
            }
            is Welcome -> {
                type = TYPE_WELCOME
                out.writeInt(sessionId)
                out.writeInt(config.sampleRate)
                out.writeByte(config.channelCount)
                out.writeByte(config.codec)
                out.writeShort(config.csd.size)
                out.write(config.csd)
            }
            is Ping -> {
                type = TYPE_PING
                out.writeLong(timeMs)
            }
            is Pong -> {
                type = TYPE_PONG
                out.writeLong(timeMs)
            }
            is Bye -> type = TYPE_BYE
        }
        val body = payload.toByteArray()
        val frame = ByteArrayOutputStream(3 + body.size)
        val head = DataOutputStream(frame)
        head.writeByte(type)
        head.writeShort(body.size)
        head.write(body)
        return frame.toByteArray()
    }

    companion object {
        const val TYPE_HELLO = 1
        const val TYPE_WELCOME = 2
        const val TYPE_PING = 3
        const val TYPE_PONG = 4
        const val TYPE_BYE = 5

        /**
         * Reads one framed message. Throws [IOException] on EOF, unknown type,
         * or malformed frame — callers treat that as a broken connection.
         */
        @Throws(IOException::class)
        fun read(input: DataInputStream): ControlMessage {
            val type = input.readUnsignedByte()
            val len = input.readUnsignedShort()
            if (len > Protocol.MAX_CONTROL_PAYLOAD) throw IOException("Control frame too large: $len")
            val body = ByteArray(len)
            input.readFully(body)
            val data = DataInputStream(body.inputStream())
            return when (type) {
                TYPE_HELLO -> Hello(
                    protocolVersion = data.readUnsignedByte(),
                    udpPort = data.readUnsignedShort(),
                    clientName = data.readUTF(),
                )
                TYPE_WELCOME -> {
                    val sessionId = data.readInt()
                    val sampleRate = data.readInt()
                    val channels = data.readUnsignedByte()
                    val codec = data.readUnsignedByte()
                    val csd = ByteArray(data.readUnsignedShort())
                    data.readFully(csd)
                    Welcome(sessionId, AudioConfig(sampleRate, channels, codec, csd))
                }
                TYPE_PING -> Ping(data.readLong())
                TYPE_PONG -> Pong(data.readLong())
                TYPE_BYE -> Bye
                else -> throw IOException("Unknown control message type: $type")
            }
        }
    }
}
