package com.fable.wifisoundthing.protocol

import org.json.JSONObject

/**
 * LAN host discovery over UDP broadcast.
 *
 * The client broadcasts [QUERY] to [Wire.DISCOVERY_PORT]; every listening host unicasts a
 * response (`WST1!` + JSON) back to the sender. The host's IP address is taken from the
 * response datagram's source address.
 */
object Discovery {
    const val QUERY = "WST1?"
    private const val RESPONSE_PREFIX = "WST1!"

    data class HostInfo(val name: String, val controlPort: Int, val version: Int)

    fun buildQuery(): ByteArray = QUERY.toByteArray(Charsets.US_ASCII)

    fun isQuery(data: ByteArray, length: Int = data.size): Boolean =
        length == QUERY.length &&
            String(data, 0, length, Charsets.US_ASCII) == QUERY

    fun buildResponse(name: String, controlPort: Int): ByteArray {
        val json = JSONObject()
            .put("name", name)
            .put("port", controlPort)
            .put("version", Wire.PROTOCOL_VERSION)
        return (RESPONSE_PREFIX + json.toString()).toByteArray(Charsets.UTF_8)
    }

    fun parseResponse(data: ByteArray, length: Int = data.size): HostInfo? {
        if (length <= RESPONSE_PREFIX.length || length > data.size) return null
        val text = String(data, 0, length, Charsets.UTF_8)
        if (!text.startsWith(RESPONSE_PREFIX)) return null
        return try {
            val json = JSONObject(text.substring(RESPONSE_PREFIX.length))
            val port = json.getInt("port")
            if (port !in 1..65535) return null
            HostInfo(
                name = json.optString("name", "Host"),
                controlPort = port,
                version = json.optInt("version", 1),
            )
        } catch (_: Exception) {
            null
        }
    }
}
