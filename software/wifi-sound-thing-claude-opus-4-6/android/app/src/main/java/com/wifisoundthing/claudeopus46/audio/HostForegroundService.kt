package com.wifisoundthing.claudeopus46.audio

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioPlaybackCaptureConfiguration
import android.media.AudioRecord
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import java.util.Timer
import java.util.TimerTask

/**
 * Android Foreground Service that captures system audio and streams it
 * over UDP to all peers.
 *
 * Supports two capture modes:
 *
 * 1. **Shizuku mode** (`CAPTURE_MODE_SHIZUKU`):
 *    Uses REMOTE_SUBMIX via a Shizuku UserService running as UID 2000.
 *    Captures ALL audio including DRM-protected apps (Spotify, Crunchyroll).
 *    Trade-off: device speaker is muted during capture.
 *
 * 2. **Projection mode** (`CAPTURE_MODE_PROJECTION`):
 *    Uses MediaProjection + AudioPlaybackCapture (existing approach).
 *    Only captures audio from apps that allow capture. Falls back when
 *    Shizuku is not available.
 *
 * Lifecycle is controlled by [ACTION_START] and [ACTION_STOP] intents
 * sent from [WifiSoundPlugin].
 */
class HostForegroundService : Service() {

    companion object {
        private const val TAG = "HostForegroundService"
        const val CHANNEL_ID = "wifi_sound_host_channel"
        const val NOTIFICATION_ID = 1001

        const val ACTION_START = "com.wifisoundthing.ACTION_START_HOST"
        const val ACTION_STOP = "com.wifisoundthing.ACTION_STOP_HOST"

        const val EXTRA_CAPTURE_MODE = "captureMode"
        const val EXTRA_RESULT_CODE = "resultCode"
        const val EXTRA_RESULT_DATA = "resultData"
        const val EXTRA_SAMPLE_RATE = "sampleRate"
        const val EXTRA_FRAME_SIZE = "frameSize"
        const val EXTRA_JITTER_BUFFER = "jitterBuffer"
        const val EXTRA_PEERS = "peers"
        const val EXTRA_HOST_NAME = "hostName"
        const val EXTRA_HOST_ADDRESS = "hostAddress"

        const val CAPTURE_MODE_SHIZUKU = "shizuku"
        const val CAPTURE_MODE_PROJECTION = "projection"

        @Volatile
        var metricsCallback: ((HostMetrics) -> Unit)? = null
    }

    data class HostMetrics(
        val packetsSent: Long,
        val bytesSent: Long,
        val peerCount: Int,
        val uptimeMs: Long
    )

    // ── Common state ─────────────────────────────────────────────────

    private var captureThread: Thread? = null
    private var metricsTimer: Timer? = null
    private var startTimeMs = 0L
    @Volatile private var capturing = false

    private var streamer: AudioStreamer? = null
    private var discoveryManager: DiscoveryManager? = null
    private val codec: AudioCodec = PcmCodec()

    private var activeCaptureMode: String = CAPTURE_MODE_PROJECTION

    // ── Projection mode state ────────────────────────────────────────

    private var mediaProjection: MediaProjection? = null
    private var audioRecord: AudioRecord? = null

    // ── Shizuku mode state ───────────────────────────────────────────

    private var remoteCapture: IRemoteAudioCapture? = null
    private var shizukuConnection: ServiceConnection? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val mode = intent.getStringExtra(EXTRA_CAPTURE_MODE) ?: CAPTURE_MODE_PROJECTION

                // Must call startForeground IMMEDIATELY (Android 14+ requirement)
                val fgType = if (mode == CAPTURE_MODE_SHIZUKU)
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                else
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    ServiceCompat.startForeground(
                        this, NOTIFICATION_ID, buildNotification("Starting..."), fgType
                    )
                } else {
                    startForeground(NOTIFICATION_ID, buildNotification("Starting..."))
                }

                startCapture(intent, mode)
            }
            ACTION_STOP -> {
                stopCapture()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        stopCapture()
        super.onDestroy()
    }

    // ── Capture entry point ──────────────────────────────────────────

    private fun startCapture(intent: Intent, mode: String) {
        val sampleRate = intent.getIntExtra(EXTRA_SAMPLE_RATE, 48000)
        val frameSize = intent.getIntExtra(EXTRA_FRAME_SIZE, 960)
        val jitterBuffer = intent.getIntExtra(EXTRA_JITTER_BUFFER, 3)
        val peerAddresses = intent.getStringArrayExtra(EXTRA_PEERS) ?: emptyArray()
        val hostName = intent.getStringExtra(EXTRA_HOST_NAME) ?: "WiFi Sound Host"
        val hostAddress = intent.getStringExtra(EXTRA_HOST_ADDRESS) ?: ""

        val config = AudioConfig(
            sampleRate = sampleRate,
            frameSizeSamples = frameSize,
            jitterBufferDepth = jitterBuffer
        )

        activeCaptureMode = mode

        // 1. Set up UDP streamer
        streamer = AudioStreamer(config, codec).also { s ->
            s.start()
            peerAddresses.forEach { addr -> s.addPeer(addr) }
        }

        // 2. Set up discovery broadcasting
        discoveryManager = DiscoveryManager(config).also {
            it.startBroadcasting(hostName, hostAddress, codec.name)
        }

        // 3. Start capture based on mode
        startTimeMs = System.currentTimeMillis()
        capturing = true

        when (mode) {
            CAPTURE_MODE_SHIZUKU -> startShizukuCapture(config)
            CAPTURE_MODE_PROJECTION -> startProjectionCapture(intent, config)
            else -> {
                Log.e(TAG, "Unknown capture mode: $mode")
                stopSelf()
                return
            }
        }

        // 4. Start metrics reporting timer (every 1 s)
        metricsTimer = Timer("HostMetrics-Timer", true).also { timer ->
            timer.scheduleAtFixedRate(object : TimerTask() {
                override fun run() {
                    val s = streamer ?: return
                    val metrics = HostMetrics(
                        packetsSent = s.packetsSent,
                        bytesSent = s.bytesSent,
                        peerCount = s.getPeerCount(),
                        uptimeMs = System.currentTimeMillis() - startTimeMs
                    )
                    metricsCallback?.invoke(metrics)
                }
            }, 1000L, 1000L)
        }

        // Update notification
        val modeLabel = if (mode == CAPTURE_MODE_SHIZUKU) "Shizuku" else "Projection"
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(
            NOTIFICATION_ID,
            buildNotification("Streaming to ${peerAddresses.size} peer(s) [$modeLabel]")
        )

        Log.d(TAG, "Host capture started ($mode) — peers: ${peerAddresses.joinToString()}")
    }

    // ── Shizuku REMOTE_SUBMIX capture ────────────────────────────────

    private fun startShizukuCapture(config: AudioConfig) {
        val connection = object : ServiceConnection {
            override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
                remoteCapture = IRemoteAudioCapture.Stub.asInterface(service)
                Log.d(TAG, "Shizuku UserService connected")

                val frameCallback = object : IFrameCallback.Stub() {
                    override fun onFrame(pcmData: ByteArray?) {
                        if (pcmData != null && capturing) {
                            streamer?.sendFrame(pcmData)
                        }
                    }
                }

                try {
                    remoteCapture?.startCapture(
                        config.sampleRate,
                        config.channels,
                        config.frameSizeSamples,
                        frameCallback
                    )
                    Log.d(TAG, "REMOTE_SUBMIX capture started via Shizuku")
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to start Shizuku capture: $e")
                    stopSelf()
                }
            }

            override fun onServiceDisconnected(name: ComponentName?) {
                Log.w(TAG, "Shizuku UserService disconnected")
                remoteCapture = null
            }
        }
        shizukuConnection = connection
        ShizukuHelper.bindAudioCaptureService(connection)
    }

    // ── Projection (AudioPlaybackCapture) capture ────────────────────

    @Suppress("DEPRECATION")
    private fun startProjectionCapture(intent: Intent, config: AudioConfig) {
        val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0)
        val resultData: Intent? = intent.getParcelableExtra(EXTRA_RESULT_DATA)
        if (resultData == null) {
            Log.e(TAG, "No MediaProjection result data — cannot capture")
            stopSelf()
            return
        }

        val projManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE)
            as MediaProjectionManager
        mediaProjection = projManager.getMediaProjection(resultCode, resultData)
        if (mediaProjection == null) {
            Log.e(TAG, "Failed to obtain MediaProjection")
            stopSelf()
            return
        }

        val captureConfig = AudioPlaybackCaptureConfiguration.Builder(mediaProjection!!)
            .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
            .addMatchingUsage(AudioAttributes.USAGE_GAME)
            .addMatchingUsage(AudioAttributes.USAGE_UNKNOWN)
            .build()

        val audioFormat = AudioFormat.Builder()
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setSampleRate(config.sampleRate)
            .setChannelMask(AudioFormat.CHANNEL_IN_STEREO)
            .build()

        val minBuf = AudioRecord.getMinBufferSize(
            config.sampleRate, AudioFormat.CHANNEL_IN_STEREO, AudioFormat.ENCODING_PCM_16BIT
        )
        val bufSize = maxOf(config.frameSizeBytes * 4, minBuf)

        audioRecord = AudioRecord.Builder()
            .setAudioPlaybackCaptureConfig(captureConfig)
            .setAudioFormat(audioFormat)
            .setBufferSizeInBytes(bufSize)
            .build()

        if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
            Log.e(TAG, "AudioRecord failed to initialise")
            stopSelf()
            return
        }

        audioRecord?.startRecording()

        captureThread = Thread({
            Log.d(TAG, "Projection capture thread started (${config.sampleRate} Hz)")
            val buffer = ByteArray(config.frameSizeBytes)

            while (capturing) {
                val bytesRead = audioRecord?.read(buffer, 0, buffer.size) ?: -1
                if (bytesRead == config.frameSizeBytes) {
                    streamer?.sendFrame(buffer.copyOf())
                } else if (bytesRead < 0) {
                    Log.w(TAG, "AudioRecord.read() returned $bytesRead")
                    break
                }
            }

            Log.d(TAG, "Projection capture thread exiting")
        }, "AudioCapture-Thread").apply {
            priority = Thread.MAX_PRIORITY
            start()
        }
    }

    // ── Stop ─────────────────────────────────────────────────────────

    private fun stopCapture() {
        if (!capturing && mediaProjection == null && remoteCapture == null) return
        capturing = false

        metricsTimer?.cancel()
        metricsTimer = null

        // Stop Shizuku capture
        try { remoteCapture?.stopCapture() } catch (_: Exception) { }
        remoteCapture = null
        shizukuConnection?.let { ShizukuHelper.unbindAudioCaptureService(it) }
        shizukuConnection = null

        // Stop projection capture
        captureThread?.join(3000)
        captureThread = null
        try { audioRecord?.stop() } catch (_: Exception) { }
        audioRecord?.release()
        audioRecord = null
        mediaProjection?.stop()
        mediaProjection = null

        // Stop streamer + discovery
        streamer?.stop()
        streamer = null
        discoveryManager?.stopBroadcasting()
        discoveryManager = null

        codec.release()

        Log.d(TAG, "Host capture stopped")
    }

    // ── Notification ─────────────────────────────────────────────────

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "WiFi Sound Host",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Shows when audio is being broadcast to peers"
        }
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(channel)
    }

    private fun buildNotification(status: String): Notification {
        val openIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingOpen = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("WiFi Sound Host")
            .setContentText(status)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(pendingOpen)
            .setOngoing(true)
            .build()
    }
}
