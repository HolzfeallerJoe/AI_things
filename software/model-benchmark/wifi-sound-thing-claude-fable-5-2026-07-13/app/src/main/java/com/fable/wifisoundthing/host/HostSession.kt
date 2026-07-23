package com.fable.wifisoundthing.host

import android.annotation.SuppressLint
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioPlaybackCaptureConfiguration
import android.media.AudioRecord
import android.media.projection.MediaProjection
import android.os.SystemClock
import android.util.Log
import com.fable.wifisoundthing.audio.AudioEncoder
import com.fable.wifisoundthing.audio.OpusEncoder
import com.fable.wifisoundthing.audio.PcmEncoder
import com.fable.wifisoundthing.net.AudioSender
import com.fable.wifisoundthing.net.ControlServer
import com.fable.wifisoundthing.net.DiscoveryResponder
import com.fable.wifisoundthing.protocol.AudioPacket
import com.fable.wifisoundthing.protocol.ControlMessage
import com.fable.wifisoundthing.protocol.Wire
import com.fable.wifisoundthing.state.HostStateHolder
import com.fable.wifisoundthing.state.HostUiState
import com.fable.wifisoundthing.util.NetUtils
import kotlin.concurrent.thread
import kotlin.math.abs

/**
 * Everything the host does while broadcasting: captures playback audio via the
 * MediaProjection-backed [AudioRecord], encodes it (Opus, or PCM fallback), unicasts the
 * packets to every connected client, runs the TCP control server and the discovery
 * responder, and publishes live status to [HostStateHolder].
 */
class HostSession(
    private val projection: MediaProjection,
    private val hostName: String,
    private val controlPort: Int,
    private val codecMode: String, // "auto" | "pcm"
    private val onClientCountChanged: (Int) -> Unit,
) {
    private var record: AudioRecord? = null
    private var encoder: AudioEncoder? = null
    private var controlServer: ControlServer? = null
    private var responder: DiscoveryResponder? = null
    private val sender = AudioSender()
    private var captureThread: Thread? = null

    @Volatile
    private var running = false

    /** Starts everything. Returns a user-facing error message, or null on success. */
    fun start(): String? {
        val enc = if (codecMode == "pcm") {
            PcmEncoder()
        } else {
            OpusEncoder.create() ?: PcmEncoder()
        }
        encoder = enc

        val rec = try {
            buildRecord()
        } catch (e: Exception) {
            Log.e(TAG, "AudioRecord setup failed", e)
            release()
            return "Could not start audio capture. Make sure the microphone permission " +
                "is granted and screen capture was allowed."
        }
        record = rec
        try {
            rec.startRecording()
        } catch (e: Exception) {
            Log.e(TAG, "startRecording failed", e)
            release()
            return "Audio capture could not be started on this device."
        }
        if (rec.recordingState != AudioRecord.RECORDSTATE_RECORDING) {
            release()
            return "Audio capture could not be started on this device."
        }

        val config = ControlMessage.Config(
            codec = Wire.codecName(enc.codecId),
            sampleRate = Wire.SAMPLE_RATE,
            channels = Wire.CHANNELS,
            frameMs = Wire.FRAME_MS,
            hostName = hostName,
            opusHead = enc.opusHead,
        )

        val server = ControlServer(controlPort, { config }, object : ControlServer.Listener {
            override fun onClientsChanged(clients: List<ControlServer.ClientEndpoint>) {
                HostStateHolder.update {
                    it.copy(clientCount = clients.size, clientNames = clients.map { c -> c.name })
                }
                onClientCountChanged(clients.size)
            }
        })
        try {
            server.start()
        } catch (e: Exception) {
            Log.e(TAG, "control server bind failed", e)
            release()
            return "Port $controlPort is already in use on this phone. " +
                "Close other broadcasting apps and try again."
        }
        controlServer = server

        responder = DiscoveryResponder({ hostName }, controlPort).also {
            try {
                it.start()
            } catch (e: Exception) {
                // Not fatal: manual connection by IP still works.
                Log.w(TAG, "discovery responder failed to start", e)
            }
        }

        running = true
        captureThread = thread(name = "host-capture") { captureLoop(rec, enc) }

        HostStateHolder.update {
            HostUiState(
                running = true,
                address = NetUtils.localIpv4(),
                controlPort = controlPort,
                codec = Wire.codecName(enc.codecId),
                startedAtMs = System.currentTimeMillis(),
            )
        }
        return null
    }

    private fun captureLoop(rec: AudioRecord, enc: AudioEncoder) {
        val blockBytes = BLOCK_BYTES
        val buf = ByteArray(blockBytes)
        var seq = 0
        var lastUiPush = 0L
        var lastLoudMs = SystemClock.elapsedRealtime()
        var readFailures = 0

        while (running) {
            val read = rec.read(buf, 0, blockBytes)
            if (read <= 0) {
                if (++readFailures > 100) {
                    HostStateHolder.update {
                        it.copy(error = "Audio capture stopped unexpectedly. Stop and start again.")
                    }
                    break
                }
                SystemClock.sleep(10)
                continue
            }
            readFailures = 0
            val now = SystemClock.elapsedRealtime()
            val ptsUs = SystemClock.elapsedRealtimeNanos() / 1000

            // Peak level of this block, for the UI meter and the "capturing silence" hint.
            var maxAbs = 0
            var i = 0
            while (i + 1 < read) {
                val sample = ((buf[i].toInt() and 0xFF) or (buf[i + 1].toInt() shl 8)).toShort().toInt()
                val a = abs(sample)
                if (a > maxAbs) maxAbs = a
                i += 2
            }
            if (maxAbs > SILENCE_THRESHOLD) lastLoudMs = now

            val targets = controlServer?.clientEndpoints()?.map { it.udpAddress }.orEmpty()
            for (frame in enc.encode(buf, read, ptsUs)) {
                val packet = AudioPacket(enc.codecId, seq++, frame.ptsUs, frame.payload).toBytes()
                if (targets.isNotEmpty()) sender.send(packet, targets)
            }

            if (now - lastUiPush >= 500) {
                lastUiPush = now
                val level = maxAbs * 100 / 32767
                val silent = now - lastLoudMs > 5_000
                HostStateHolder.update {
                    it.copy(
                        bytesSent = sender.bytesSent.get(),
                        levelPercent = level,
                        captureSilent = silent,
                    )
                }
            }
        }
    }

    fun stop() {
        running = false
        captureThread?.join(1_500)
        release()
        HostStateHolder.reset()
    }

    private fun release() {
        try {
            record?.stop()
        } catch (_: Exception) {
        }
        try {
            record?.release()
        } catch (_: Exception) {
        }
        record = null
        encoder?.release()
        encoder = null
        controlServer?.stop()
        controlServer = null
        responder?.stop()
        responder = null
        sender.close()
    }

    @SuppressLint("MissingPermission") // RECORD_AUDIO is checked before the service starts
    private fun buildRecord(): AudioRecord {
        val captureConfig = AudioPlaybackCaptureConfiguration.Builder(projection)
            .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
            .addMatchingUsage(AudioAttributes.USAGE_GAME)
            .addMatchingUsage(AudioAttributes.USAGE_UNKNOWN)
            .build()
        val format = AudioFormat.Builder()
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setSampleRate(Wire.SAMPLE_RATE)
            .setChannelMask(AudioFormat.CHANNEL_IN_STEREO)
            .build()
        return AudioRecord.Builder()
            .setAudioPlaybackCaptureConfig(captureConfig)
            .setAudioFormat(format)
            .setBufferSizeInBytes(BLOCK_BYTES * 4)
            .build()
    }

    companion object {
        private const val TAG = "HostSession"

        /** One 20 ms block of 48 kHz stereo 16-bit PCM. */
        private const val BLOCK_BYTES =
            Wire.SAMPLE_RATE / (1000 / Wire.FRAME_MS) * Wire.CHANNELS * Wire.BYTES_PER_SAMPLE

        /** Peak sample value below which a block counts as silence (~-40 dBFS). */
        private const val SILENCE_THRESHOLD = 330
    }
}
