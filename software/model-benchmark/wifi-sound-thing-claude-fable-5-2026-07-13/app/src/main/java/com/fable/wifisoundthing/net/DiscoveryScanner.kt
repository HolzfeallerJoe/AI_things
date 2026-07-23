package com.fable.wifisoundthing.net

import com.fable.wifisoundthing.protocol.Discovery
import com.fable.wifisoundthing.protocol.Wire
import com.fable.wifisoundthing.util.NetUtils
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.SocketTimeoutException

data class DiscoveredHost(val name: String, val address: String, val port: Int) {
    val display: String get() = "$name ($address)"
}

/** Client side of discovery: broadcast a query and collect responses for a short window. */
object DiscoveryScanner {

    /** Blocking; call from a background thread. Returns hosts found within [windowMs]. */
    fun scan(windowMs: Long = 1200): List<DiscoveredHost> {
        val found = LinkedHashMap<String, DiscoveredHost>()
        var socket: DatagramSocket? = null
        try {
            socket = DatagramSocket()
            socket.broadcast = true
            socket.soTimeout = 300
            val query = Discovery.buildQuery()
            for (addr in NetUtils.broadcastAddresses()) {
                try {
                    socket.send(DatagramPacket(query, query.size, addr, Wire.DISCOVERY_PORT))
                } catch (_: Exception) {
                }
            }
            val deadline = System.currentTimeMillis() + windowMs
            val buf = ByteArray(1024)
            while (System.currentTimeMillis() < deadline) {
                try {
                    val packet = DatagramPacket(buf, buf.size)
                    socket.receive(packet)
                    val info = Discovery.parseResponse(packet.data, packet.length) ?: continue
                    val address = packet.address.hostAddress ?: continue
                    found[address] = DiscoveredHost(info.name, address, info.controlPort)
                } catch (_: SocketTimeoutException) {
                    // keep waiting until the window closes
                } catch (_: Exception) {
                    break
                }
            }
        } catch (_: Exception) {
            // No network — return what we have (usually nothing).
        } finally {
            try {
                socket?.close()
            } catch (_: Exception) {
            }
        }
        return found.values.toList()
    }
}
