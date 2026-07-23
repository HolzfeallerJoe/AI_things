package com.fable.wifisoundthing.protocol

import org.json.JSONObject
import java.util.Base64

/**
 * Messages exchanged on the TCP control channel, one JSON object per line.
 *
 * Handshake: client sends [Hello], host answers [Config]. Afterwards the client sends
 * [Ping] periodically and the host answers [Pong]; either side may send [Bye].
 */
sealed class ControlMessage {

    data class Hello(
        val name: String,
        val udpPort: Int,
        val version: Int = Wire.PROTOCOL_VERSION,
    ) : ControlMessage() {
        override fun toJson(): String = JSONObject()
            .put("type", "hello")
            .put("name", name)
            .put("udpPort", udpPort)
            .put("version", version)
            .toString()
    }

    data class Config(
        val codec: String,
        val sampleRate: Int,
        val channels: Int,
        val frameMs: Int,
        val hostName: String,
        val opusHead: ByteArray? = null,
    ) : ControlMessage() {
        override fun toJson(): String {
            val json = JSONObject()
                .put("type", "config")
                .put("codec", codec)
                .put("sampleRate", sampleRate)
                .put("channels", channels)
                .put("frameMs", frameMs)
                .put("hostName", hostName)
            if (opusHead != null) {
                json.put("opusHead", Base64.getEncoder().encodeToString(opusHead))
            }
            return json.toString()
        }
    }

    object Ping : ControlMessage() {
        override fun toJson(): String = """{"type":"ping"}"""
    }

    object Pong : ControlMessage() {
        override fun toJson(): String = """{"type":"pong"}"""
    }

    data class Bye(val reason: String) : ControlMessage() {
        override fun toJson(): String =
            JSONObject().put("type", "bye").put("reason", reason).toString()
    }

    abstract fun toJson(): String

    companion object {
        /** Parses one line; returns null for malformed or unknown input. */
        fun parse(line: String): ControlMessage? {
            val json = try {
                JSONObject(line)
            } catch (_: Exception) {
                return null
            }
            return try {
                when (json.optString("type")) {
                    "hello" -> Hello(
                        name = json.optString("name", "?"),
                        udpPort = json.getInt("udpPort"),
                        version = json.optInt("version", 1),
                    )
                    "config" -> Config(
                        codec = json.getString("codec"),
                        sampleRate = json.getInt("sampleRate"),
                        channels = json.getInt("channels"),
                        frameMs = json.optInt("frameMs", Wire.FRAME_MS),
                        hostName = json.optString("hostName", "Host"),
                        opusHead = json.optString("opusHead", "").takeIf { it.isNotEmpty() }
                            ?.let { Base64.getDecoder().decode(it) },
                    )
                    "ping" -> Ping
                    "pong" -> Pong
                    "bye" -> Bye(json.optString("reason", ""))
                    else -> null
                }
            } catch (_: Exception) {
                null
            }
        }
    }
}
