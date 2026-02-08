package com.wifisoundthing.claudeopus46.audio

import android.util.Log
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.SocketException

/**
 * UDP beacon-based discovery system.
 *
 * **Host mode:** broadcasts a JSON beacon every 2 s to 255.255.255.255
 * on [AudioConfig.discoveryPort].
 *
 * **Client mode:** listens for beacons and reports discovered/lost hosts
 * via [DiscoveryListener].  A host is considered lost if no beacon is
 * received for 6 seconds.
 */
data class DiscoveryBeacon(
    val type: String,
    val name: String,
    val address: String,
    val port: Int,
    val codec: String,
    val sampleRate: Int,
    val channels: Int
)

interface DiscoveryListener {
    fun onHostDiscovered(beacon: DiscoveryBeacon)
    fun onHostLost(address: String)
}

class DiscoveryManager(private val config: AudioConfig) {

    companion object {
        private const val TAG = "DiscoveryManager"
        private const val BEACON_TYPE = "wifi-sound-beacon"
        private const val BROADCAST_INTERVAL_MS = 2000L
        private const val HOST_TIMEOUT_MS = 6000L
        private const val CLEANUP_INTERVAL_MS = 3000L
    }

    // ── Host (broadcast) ──────────────────────────────────────────────

    private var broadcastThread: Thread? = null
    private var broadcastSocket: DatagramSocket? = null

    @Volatile
    private var broadcasting = false

    fun startBroadcasting(hostName: String, hostAddress: String, codecName: String) {
        if (broadcasting) return
        broadcasting = true

        broadcastSocket = DatagramSocket().apply { broadcast = true }

        broadcastThread = Thread({
            Log.d(TAG, "Beacon broadcast started for $hostName ($hostAddress)")
            val beacon = JSONObject().apply {
                put("type", BEACON_TYPE)
                put("name", hostName)
                put("address", hostAddress)
                put("port", config.streamPort)
                put("codec", codecName)
                put("sampleRate", config.sampleRate)
                put("channels", config.channels)
            }
            val bytes = beacon.toString().toByteArray(Charsets.UTF_8)
            val broadcastAddr = InetAddress.getByName("255.255.255.255")

            while (broadcasting) {
                try {
                    val packet = DatagramPacket(
                        bytes, bytes.size, broadcastAddr, config.discoveryPort
                    )
                    broadcastSocket?.send(packet)
                } catch (e: SocketException) {
                    if (broadcasting) Log.w(TAG, "Broadcast send failed: ${e.message}")
                } catch (e: Exception) {
                    if (broadcasting) Log.w(TAG, "Broadcast error: ${e.message}")
                }
                try {
                    Thread.sleep(BROADCAST_INTERVAL_MS)
                } catch (_: InterruptedException) {
                    break
                }
            }
            Log.d(TAG, "Beacon broadcast stopped")
        }, "Discovery-Broadcast-Thread").apply { isDaemon = true; start() }
    }

    fun stopBroadcasting() {
        broadcasting = false
        broadcastThread?.interrupt()
        try { broadcastSocket?.close() } catch (_: Exception) { }
        broadcastThread?.join(3000)
        broadcastThread = null
        broadcastSocket = null
    }

    // ── Client (listen) ───────────────────────────────────────────────

    private var listenThread: Thread? = null
    private var cleanupThread: Thread? = null
    private var listenSocket: DatagramSocket? = null

    @Volatile
    private var listening = false

    private val knownHosts = mutableMapOf<String, Long>() // address → lastSeenMs

    fun startListening(listener: DiscoveryListener) {
        if (listening) return
        listening = true
        knownHosts.clear()

        listenSocket = DatagramSocket(config.discoveryPort).apply {
            broadcast = true
            soTimeout = 3000
        }

        // Beacon receive thread
        listenThread = Thread({
            Log.d(TAG, "Discovery listening started on port ${config.discoveryPort}")
            val buf = ByteArray(2048)

            while (listening) {
                try {
                    val dgram = DatagramPacket(buf, buf.size)
                    listenSocket?.receive(dgram)

                    val json = String(buf, 0, dgram.length, Charsets.UTF_8)
                    val obj = JSONObject(json)
                    if (obj.optString("type") != BEACON_TYPE) continue

                    val beacon = DiscoveryBeacon(
                        type = obj.getString("type"),
                        name = obj.getString("name"),
                        address = obj.getString("address"),
                        port = obj.getInt("port"),
                        codec = obj.getString("codec"),
                        sampleRate = obj.getInt("sampleRate"),
                        channels = obj.getInt("channels")
                    )

                    val isNew: Boolean
                    synchronized(knownHosts) {
                        isNew = !knownHosts.containsKey(beacon.address)
                        knownHosts[beacon.address] = System.currentTimeMillis()
                    }

                    if (isNew) {
                        Log.d(TAG, "Host discovered: ${beacon.name} (${beacon.address})")
                    }
                    listener.onHostDiscovered(beacon)
                } catch (_: java.net.SocketTimeoutException) {
                    // Expected — loop back to check `listening`
                } catch (e: SocketException) {
                    if (listening) Log.w(TAG, "Listen socket error: ${e.message}")
                } catch (e: Exception) {
                    if (listening) Log.w(TAG, "Listen error: ${e.message}")
                }
            }

            Log.d(TAG, "Discovery listening stopped")
        }, "Discovery-Listen-Thread").apply { isDaemon = true; start() }

        // Cleanup thread — detects hosts that stopped broadcasting
        cleanupThread = Thread({
            while (listening) {
                try {
                    Thread.sleep(CLEANUP_INTERVAL_MS)
                } catch (_: InterruptedException) {
                    break
                }

                val now = System.currentTimeMillis()
                val lostAddresses = mutableListOf<String>()

                synchronized(knownHosts) {
                    val iter = knownHosts.iterator()
                    while (iter.hasNext()) {
                        val entry = iter.next()
                        if (now - entry.value > HOST_TIMEOUT_MS) {
                            lostAddresses.add(entry.key)
                            iter.remove()
                        }
                    }
                }

                for (addr in lostAddresses) {
                    Log.d(TAG, "Host lost: $addr")
                    listener.onHostLost(addr)
                }
            }
        }, "Discovery-Cleanup-Thread").apply { isDaemon = true; start() }
    }

    fun stopListening() {
        listening = false
        listenThread?.interrupt()
        cleanupThread?.interrupt()
        try { listenSocket?.close() } catch (_: Exception) { }
        listenThread?.join(4000)
        cleanupThread?.join(4000)
        listenThread = null
        cleanupThread = null
        listenSocket = null
        synchronized(knownHosts) { knownHosts.clear() }
    }
}
