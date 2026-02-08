package com.wifisoundthing.claudeopus46.audio

import android.util.Log
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.SocketException

/**
 * Client-side UDP listener.
 *
 * A dedicated thread receives audio packets on [AudioConfig.streamPort],
 * deserialises them, decodes via [AudioCodec], and feeds the [JitterBuffer].
 */
class AudioReceiver(
    private val config: AudioConfig,
    private val codec: AudioCodec,
    private val jitterBuffer: JitterBuffer
) {
    companion object {
        private const val TAG = "AudioReceiver"
    }

    private var socket: DatagramSocket? = null
    private var receiveThread: Thread? = null

    @Volatile
    private var running = false

    // Metrics
    @Volatile var packetsReceived = 0L; private set
    @Volatile var bytesReceived = 0L; private set
    @Volatile var lastLatencyUs = 0L; private set

    fun start() {
        socket = DatagramSocket(config.streamPort).apply {
            receiveBufferSize = config.frameSizeBytes * 20
            soTimeout = 3000 // 3 s timeout so we can check `running` periodically
        }

        running = true
        packetsReceived = 0
        bytesReceived = 0
        lastLatencyUs = 0

        receiveThread = Thread({
            Log.d(TAG, "Receive thread started on port ${config.streamPort}")
            val maxPacketSize = AudioPacket.HEADER_SIZE + config.frameSizeBytes + 256
            val buffer = ByteArray(maxPacketSize)

            while (running) {
                try {
                    val dgram = DatagramPacket(buffer, buffer.size)
                    socket?.receive(dgram)

                    val data = buffer.copyOf(dgram.length)
                    val packet = AudioPacket.deserialize(data) ?: continue

                    val decoded = codec.decode(packet.payload)
                    jitterBuffer.put(packet.sequenceNumber, decoded)

                    packetsReceived++
                    bytesReceived += dgram.length.toLong()
                    lastLatencyUs = (System.nanoTime() / 1000) - packet.timestampUs
                } catch (_: java.net.SocketTimeoutException) {
                    // Expected when no data — loop back to check `running`
                } catch (e: SocketException) {
                    if (running) Log.w(TAG, "Socket error: ${e.message}")
                } catch (e: Exception) {
                    if (running) Log.w(TAG, "Receive error: ${e.message}")
                }
            }

            Log.d(TAG, "Receive thread exiting")
        }, "AudioReceiver-Thread").apply {
            priority = Thread.MAX_PRIORITY - 1
            start()
        }
    }

    fun stop() {
        running = false
        try {
            socket?.close()
        } catch (_: Exception) { }
        receiveThread?.join(4000)
        receiveThread = null
        socket = null
        Log.d(TAG, "Receiver stopped")
    }
}
