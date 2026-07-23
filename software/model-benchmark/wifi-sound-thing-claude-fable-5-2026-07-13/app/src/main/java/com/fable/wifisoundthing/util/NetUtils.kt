package com.fable.wifisoundthing.util

import java.net.Inet4Address
import java.net.InetAddress
import java.net.NetworkInterface

object NetUtils {

    /** The device's LAN IPv4 address, preferring the Wi-Fi interface. */
    fun localIpv4(): String? {
        val candidates = ArrayList<Pair<String, String>>() // interface name -> address
        try {
            for (nif in NetworkInterface.getNetworkInterfaces()) {
                if (!nif.isUp || nif.isLoopback) continue
                for (addr in nif.inetAddresses) {
                    if (addr is Inet4Address && !addr.isLoopbackAddress) {
                        candidates.add(nif.name to addr.hostAddress.orEmpty())
                    }
                }
            }
        } catch (_: Exception) {
        }
        return candidates.firstOrNull { it.first.startsWith("wlan") }?.second
            ?: candidates.firstOrNull { it.first.startsWith("ap") || it.first.startsWith("swlan") }?.second
            ?: candidates.firstOrNull()?.second
    }

    /** Broadcast addresses of all up interfaces, plus the limited broadcast address. */
    fun broadcastAddresses(): List<InetAddress> {
        val out = LinkedHashSet<InetAddress>()
        try {
            out.add(InetAddress.getByName("255.255.255.255"))
            for (nif in NetworkInterface.getNetworkInterfaces()) {
                if (!nif.isUp || nif.isLoopback) continue
                for (ifAddr in nif.interfaceAddresses) {
                    ifAddr.broadcast?.let { out.add(it) }
                }
            }
        } catch (_: Exception) {
        }
        return out.toList()
    }
}
