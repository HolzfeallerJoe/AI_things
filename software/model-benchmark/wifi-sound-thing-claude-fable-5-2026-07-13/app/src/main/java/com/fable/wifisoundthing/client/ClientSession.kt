package com.fable.wifisoundthing.client

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.os.SystemClock
import android.util.Log
import com.fable.wifisoundthing.audio.AudioDecoder
import com.fable.wifisoundthing.audio.OpusDecoder
import com.fable.wifisoundthing.audio.PcmDecoder
import com.fable.wifisoundthing.protocol.AudioPacket
import com.fable.wifisoundthing.protocol.ControlMessage
import com.fable.wifisoundthing.protocol.JitterBuffer
import com.fable.wifisoundthing.protocol.OpusCsd
import com.fable.wifisoundthing.protocol.Wire
import com.fable.wifisoundthing.state.ClientPhase
import com.fable.wifisoundthing.state.ClientStateHolder
import java.io.BufferedReader
import java.io.BufferedWriter
import java.io.IOException
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.ConnectException
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetSocketAddress
import java.net.NoRouteToHostException
import java.net.Socket
import java.net.SocketTimeoutException
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import kotlin.concurrent.thread
import kotlin.math.max
import kotlin.math.min

/**
 * One client connection lifecycle, including automatic reconnection: TCP handshake, UDP
 * audio reception into a [JitterBuffer], decoding, and low-latency [AudioTrack] playback.
 * Publishes live status to [ClientStateHolder].
 */
class ClientSession(
    private val hostAddress: String,
    private val hostPort: Int,
    private val deviceName: String,
    private val targetBufferMs: Int,
) {
    @Volatile
    private var running = false
    private var mainThread: Thread? = null

    @Volatile
    private var currentSocket: Socket? = null

    @Volatile
    private var currentUdp: DatagramSocket? = null

    fun start() {
        running = true
        mainThread = thread(name = "client-main") { runLoop() }
    }

    fun stop() {
        running = false
        try {
            currentSocket?.close()
        } catch (_: Exception) {
        }
        try {
            currentUdp?.close()
        } catch (_: Exception) {
        }
        mainThread?.join(3_000)
        ClientStateHolder.reset()
    }

    private fun runLoop() {
        var everConnected = false
        var attempt = 0
        while (running) {
            ClientStateHolder.update {
                it.copy(
                    phase = if (everConnected) ClientPhase.RECONNECTING else ClientPhase.CONNECTING,
                    hostAddress = "$hostAddress:$hostPort",
                    error = null,
                )
            }
            var failure: String? = null
            try {
                runOnce { everConnected = true; attempt = 0 }
            } catch (e: Exception) {
                if (!running) break
                failure = friendlyMessage(e)
                Log.d(TAG, "session ended: ${e.message}")
            }
            if (!running) break
            attempt++
            val waitMs = min(8_000L, 1_000L * (1L shl min(attempt - 1, 3)))
            ClientStateHolder.update {
                it.copy(
                    phase = ClientPhase.RECONNECTING,
                    error = (failure ?: "Connection lost.") + " Retrying…",
                )
            }
            var waited = 0L
            while (running && waited < waitMs) {
                SystemClock.sleep(100)
                waited += 100
            }
        }
        ClientStateHolder.update { it.copy(phase = ClientPhase.IDLE) }
    }

    /** One connection from handshake to disconnect. Throws when the connection ends. */
    private fun runOnce(onConnected: () -> Unit) {
        val active = AtomicBoolean(true)
        val bytesReceived = AtomicLong(0)
        val udp = DatagramSocket()
        currentUdp = udp
        val socket = Socket()
        currentSocket = socket
        var decoder: AudioDecoder? = null
        var receiverThread: Thread? = null
        var playerThread: Thread? = null
        try {
            socket.connect(InetSocketAddress(hostAddress, hostPort), CONNECT_TIMEOUT_MS)
            socket.tcpNoDelay = true
            val reader = BufferedReader(InputStreamReader(socket.getInputStream(), Charsets.UTF_8))
            val writer = BufferedWriter(OutputStreamWriter(socket.getOutputStream(), Charsets.UTF_8))

            sendLine(writer, ControlMessage.Hello(deviceName, udp.localPort))
            socket.soTimeout = HANDSHAKE_TIMEOUT_MS
            val config = ControlMessage.parse(
                reader.readLine() ?: throw IOException("host closed the connection")
            ) as? ControlMessage.Config ?: throw HandshakeException()

            decoder = when (config.codec) {
                "opus" -> OpusDecoder.create(
                    config.opusHead ?: OpusCsd.defaultOpusHead(config.channels, config.sampleRate),
                    config.sampleRate,
                    config.channels,
                ) ?: throw DecoderException()
                "pcm16" -> PcmDecoder()
                else -> throw HandshakeException()
            }

            val bytesPerMs = config.sampleRate * config.channels * Wire.BYTES_PER_SAMPLE / 1000
            val packetMs = if (config.codec == "pcm16") {
                max(1, Wire.PCM_CHUNK_BYTES / bytesPerMs)
            } else {
                config.frameMs
            }
            val prebuffer = max(2, targetBufferMs / packetMs)
            val jitterBuffer = JitterBuffer(
                prebufferPackets = prebuffer,
                maxDepthPackets = max(25, prebuffer * 8),
                reorderWindow = 2,
            )

            onConnected()
            ClientStateHolder.update {
                it.copy(
                    phase = ClientPhase.CONNECTED,
                    hostName = config.hostName,
                    codec = config.codec,
                    error = null,
                )
            }

            receiverThread = thread(name = "client-udp") {
                receiveLoop(active, udp, jitterBuffer, bytesReceived)
            }
            playerThread = thread(name = "client-player") {
                playLoop(active, jitterBuffer, decoder!!, config, packetMs, bytesPerMs, bytesReceived)
            }

            // Control loop: answer for liveness. Any exception tears the session down.
            socket.soTimeout = PING_INTERVAL_MS
            var lastRxMs = SystemClock.elapsedRealtime()
            while (active.get() && running) {
                try {
                    val line = reader.readLine() ?: throw IOException("host closed the connection")
                    lastRxMs = SystemClock.elapsedRealtime()
                    when (val msg = ControlMessage.parse(line)) {
                        is ControlMessage.Bye -> throw ByeException(msg.reason)
                        else -> {} // pong or anything else: liveness confirmed
                    }
                } catch (_: SocketTimeoutException) {
                    if (SystemClock.elapsedRealtime() - lastRxMs > LIVENESS_TIMEOUT_MS) {
                        throw IOException("host is not responding")
                    }
                    sendLine(writer, ControlMessage.Ping)
                }
            }
        } finally {
            active.set(false)
            try {
                socket.close()
            } catch (_: Exception) {
            }
            try {
                udp.close()
            } catch (_: Exception) {
            }
            receiverThread?.join(2_000)
            playerThread?.join(2_000)
            decoder?.release()
        }
    }

    private fun receiveLoop(
        active: AtomicBoolean,
        udp: DatagramSocket,
        jitterBuffer: JitterBuffer,
        bytesReceived: AtomicLong,
    ) {
        try {
            udp.soTimeout = 1_000
        } catch (_: Exception) {
            return
        }
        val buf = ByteArray(4096)
        while (active.get()) {
            try {
                val datagram = DatagramPacket(buf, buf.size)
                udp.receive(datagram)
                val packet = AudioPacket.parse(datagram.data, datagram.length) ?: continue
                jitterBuffer.push(packet.seq, packet.payload)
                bytesReceived.addAndGet(datagram.length.toLong())
            } catch (_: SocketTimeoutException) {
                // no packets right now; keep listening while the control channel decides
            } catch (_: Exception) {
                break
            }
        }
    }

    private fun playLoop(
        active: AtomicBoolean,
        jitterBuffer: JitterBuffer,
        decoder: AudioDecoder,
        config: ControlMessage.Config,
        packetMs: Int,
        bytesPerMs: Int,
        bytesReceived: AtomicLong,
    ) {
        val channelMask = if (config.channels == 1) {
            AudioFormat.CHANNEL_OUT_MONO
        } else {
            AudioFormat.CHANNEL_OUT_STEREO
        }
        val minBuf = AudioTrack.getMinBufferSize(
            config.sampleRate, channelMask, AudioFormat.ENCODING_PCM_16BIT
        )
        val track = try {
            AudioTrack.Builder()
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build()
                )
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(config.sampleRate)
                        .setChannelMask(channelMask)
                        .build()
                )
                .setTransferMode(AudioTrack.MODE_STREAM)
                .setPerformanceMode(AudioTrack.PERFORMANCE_MODE_LOW_LATENCY)
                .setBufferSizeInBytes(max(minBuf, 40 * bytesPerMs))
                .build()
        } catch (e: Exception) {
            Log.e(TAG, "AudioTrack setup failed", e)
            ClientStateHolder.update {
                it.copy(error = "Audio playback could not be started on this phone.")
            }
            active.set(false)
            return
        }
        val silence = ByteArray(packetMs * bytesPerMs)
        var ptsUs = 0L
        var lastStatsMs = 0L
        var lastStatsBytes = 0L
        try {
            track.play()
            while (active.get()) {
                when (val result = jitterBuffer.pop()) {
                    is JitterBuffer.PopResult.Packet -> {
                        ptsUs += packetMs * 1_000L
                        val pcm = decoder.decode(result.payload, ptsUs)
                        if (pcm.isNotEmpty()) track.write(pcm, 0, pcm.size)
                    }
                    JitterBuffer.PopResult.Missing -> {
                        track.write(silence, 0, silence.size)
                    }
                    JitterBuffer.PopResult.Waiting -> {
                        SystemClock.sleep(2)
                    }
                }
                val now = SystemClock.elapsedRealtime()
                if (now - lastStatsMs >= 500) {
                    val stats = jitterBuffer.stats()
                    val totalBytes = bytesReceived.get()
                    val kbps = if (lastStatsMs == 0L) 0 else {
                        ((totalBytes - lastStatsBytes) * 8 / (now - lastStatsMs)).toInt()
                    }
                    lastStatsMs = now
                    lastStatsBytes = totalBytes
                    val total = stats.received + stats.lost
                    ClientStateHolder.update {
                        it.copy(
                            lossPercent = if (total > 0) stats.lost * 100.0 / total else 0.0,
                            bufferMs = stats.depthPackets * packetMs,
                            kbps = kbps,
                            packetsReceived = stats.received,
                        )
                    }
                }
            }
        } finally {
            try {
                track.stop()
            } catch (_: Exception) {
            }
            track.release()
        }
    }

    private fun sendLine(writer: BufferedWriter, message: ControlMessage) {
        writer.write(message.toJson())
        writer.write("\n")
        writer.flush()
    }

    private fun friendlyMessage(e: Exception): String = when (e) {
        is ByeException -> if (e.reason.isNotBlank()) e.reason else "The host ended the broadcast."
        is HandshakeException -> "Connected, but the other device did not respond like a host. " +
            "Check the address and that the host has started broadcasting."
        is DecoderException -> "This phone cannot decode the host's audio format. " +
            "Ask the host to switch the codec setting to PCM."
        is ConnectException, is NoRouteToHostException ->
            "Could not reach the host. Make sure both phones are on the same Wi-Fi network " +
                "and the host is broadcasting."
        is SocketTimeoutException -> "The host did not respond in time."
        else -> "The connection to the host was lost."
    }

    private class HandshakeException : IOException("bad handshake")
    private class DecoderException : IOException("no decoder")
    private class ByeException(val reason: String) : IOException("bye: $reason")

    companion object {
        private const val TAG = "ClientSession"
        private const val CONNECT_TIMEOUT_MS = 4_000
        private const val HANDSHAKE_TIMEOUT_MS = 5_000
        private const val PING_INTERVAL_MS = 4_000
        private const val LIVENESS_TIMEOUT_MS = 15_000
    }
}
