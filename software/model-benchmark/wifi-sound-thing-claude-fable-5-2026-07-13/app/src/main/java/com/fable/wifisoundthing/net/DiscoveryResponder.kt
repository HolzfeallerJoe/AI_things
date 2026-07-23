package com.fable.wifisoundthing.net

import android.util.Log
import com.fable.wifisoundthing.protocol.Discovery
import com.fable.wifisoundthing.protocol.Wire
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetSocketAddress
import kotlin.concurrent.thread

/** Host side of discovery: answers UDP broadcast queries with our name and control port. */
class DiscoveryResponder(
    private val nameProvider: () -> String,
    private val controlPort: Int,
) {
    private var socket: DatagramSocket? = null

    @Volatile
    private var running = false

    /** Throws if the discovery port cannot be bound (e.g. another host app running). */
    fun start() {
        val s = DatagramSocket(null)
        s.reuseAddress = true
        s.bind(InetSocketAddress(Wire.DISCOVERY_PORT))
        socket = s
        running = true
        thread(name = "discovery-responder", isDaemon = true) {
            val buf = ByteArray(256)
            while (running) {
                try {
                    val packet = DatagramPacket(buf, buf.size)
                    s.receive(packet)
                    if (Discovery.isQuery(packet.data, packet.length)) {
                        val response = Discovery.buildResponse(nameProvider(), controlPort)
                        s.send(DatagramPacket(response, response.size, packet.socketAddress))
                    }
                } catch (e: Exception) {
                    if (running) Log.d(TAG, "discovery receive failed: ${e.message}")
                }
            }
        }
    }

    fun stop() {
        running = false
        try {
            socket?.close()
        } catch (_: Exception) {
        }
    }

    companion object {
        private const val TAG = "DiscoveryResponder"
    }
}
