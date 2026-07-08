package com.wifisoundthing.claudeopus46.audio

import android.util.Log
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicInteger

/**
 * Host-side UDP sender.
 *
 * Maintains a list of peer addresses and sends every encoded audio frame
 * to all of them via unicast UDP on [AudioConfig.streamPort].
 *
 * [sendFrame] is called directly from the capture thread to minimise latency.
 */
class AudioStreamer(
    private val config: AudioConfig,
    private val codec: AudioCodec
) {
    companion object {
        private const val TAG = "AudioStreamer"
    }

    private val peers = CopyOnWriteArrayList<InetAddress>()
    private var socket: DatagramSocket? = null
    private val sequenceCounter = AtomicInteger(0)

    // Metrics
    @Volatile var packetsSent = 0L; private set
    @Volatile var bytesSent = 0L; private set

    fun start() {
        socket = DatagramSocket().apply {
            sendBufferSize = config.frameSizeBytes * 10
        }
        sequenceCounter.set(0)
        packetsSent = 0
        bytesSent = 0
        Log.d(TAG, "Streamer started, sending to port ${config.streamPort}")
    }

    fun addPeer(address: String) {
        try {
            val addr = InetAddress.getByName(address)
            if (!peers.contains(addr)) {
                peers.add(addr)
                Log.d(TAG, "Peer added: $address")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Invalid peer address: $address", e)
        }
    }

    fun removePeer(address: String) {
        peers.removeIf { it.hostAddress == address }
        Log.d(TAG, "Peer removed: $address")
    }

    fun getPeerCount(): Int = peers.size

    /**
     * Called from the capture thread with a raw PCM frame.
     * Encodes, wraps in an [AudioPacket], serialises, and sends to every peer.
     */
    fun sendFrame(pcmData: ByteArray) {
        val encoded = codec.encode(pcmData)
        val packet = AudioPacket(
            sequenceNumber = sequenceCounter.getAndIncrement(),
            timestampUs = System.nanoTime() / 1000,
            codecId = codec.codecId,
            payload = encoded
        )
        val bytes = AudioPacket.serialize(packet)
        val sock = socket ?: return

        for (peer in peers) {
            try {
                val dgram = DatagramPacket(bytes, bytes.size, peer, config.streamPort)
                sock.send(dgram)
            } catch (e: Exception) {
                Log.w(TAG, "Send to ${peer.hostAddress} failed: ${e.message}")
            }
        }

        packetsSent++
        bytesSent += bytes.size.toLong() * peers.size
    }

    fun stop() {
        try {
            socket?.close()
        } catch (_: Exception) { }
        socket = null
        peers.clear()
        Log.d(TAG, "Streamer stopped")
    }
}
