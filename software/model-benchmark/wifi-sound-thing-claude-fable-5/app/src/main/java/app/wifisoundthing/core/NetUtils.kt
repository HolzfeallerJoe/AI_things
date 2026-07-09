package app.wifisoundthing.core

/** Pure helpers for choosing which local address to show to the user. */
object NetUtils {
    /**
     * Picks the IPv4 address most likely to be the phone's Wi-Fi/hotspot address.
     * Preference: 192.168.x.x, then 10.x.x.x, then 172.16-31.x.x, then anything
     * that is not loopback/link-local. Returns null if nothing qualifies.
     */
    fun pickDisplayAddress(candidates: List<String>): String? {
        val usable = candidates.filter { isUsableIpv4(it) }
        return usable.firstOrNull { it.startsWith("192.168.") }
            ?: usable.firstOrNull { it.startsWith("10.") }
            ?: usable.firstOrNull { isPrivate172(it) }
            ?: usable.firstOrNull()
    }

    fun isUsableIpv4(address: String): Boolean {
        val parts = address.split(".")
        if (parts.size != 4) return false
        val octets = parts.map { it.toIntOrNull() ?: return false }
        if (octets.any { it !in 0..255 }) return false
        if (octets[0] == 127) return false // loopback
        if (octets[0] == 169 && octets[1] == 254) return false // link-local
        return true
    }

    private fun isPrivate172(address: String): Boolean {
        if (!address.startsWith("172.")) return false
        val second = address.split(".").getOrNull(1)?.toIntOrNull() ?: return false
        return second in 16..31
    }

    /** Validates a user-typed "host" or "host:port" string; returns host to port or null. */
    fun parseHostPort(input: String, defaultPort: Int = Protocol.DEFAULT_CONTROL_PORT): Pair<String, Int>? {
        val trimmed = input.trim()
        if (trimmed.isEmpty()) return null
        val colon = trimmed.lastIndexOf(':')
        return if (colon >= 0) {
            val host = trimmed.substring(0, colon).trim()
            val port = trimmed.substring(colon + 1).toIntOrNull() ?: return null
            if (host.isEmpty() || port !in 1..65535) return null
            host to port
        } else {
            trimmed to defaultPort
        }
    }
}
