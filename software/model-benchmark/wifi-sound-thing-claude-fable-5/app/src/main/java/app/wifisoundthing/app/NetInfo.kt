package app.wifisoundthing.app

import app.wifisoundthing.core.NetUtils
import java.net.Inet4Address
import java.net.NetworkInterface

/** Android-side network helpers (the pure selection logic lives in core.NetUtils). */
object NetInfo {
    /** The IPv4 address to show the user for manual connections, or null if offline. */
    fun displayAddress(): String? {
        val candidates = try {
            NetworkInterface.getNetworkInterfaces().toList()
                .filter { it.isUp && !it.isLoopback }
                .flatMap { nic -> nic.inetAddresses.toList() }
                .filterIsInstance<Inet4Address>()
                .mapNotNull { it.hostAddress }
        } catch (e: Exception) {
            emptyList()
        }
        return NetUtils.pickDisplayAddress(candidates)
    }
}
