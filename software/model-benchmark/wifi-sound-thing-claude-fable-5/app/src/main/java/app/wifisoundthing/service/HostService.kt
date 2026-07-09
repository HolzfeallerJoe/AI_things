package app.wifisoundthing.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import app.wifisoundthing.R
import app.wifisoundthing.app.HostSession
import app.wifisoundthing.app.NetInfo
import app.wifisoundthing.app.Prefs
import app.wifisoundthing.audio.CaptureEngine
import app.wifisoundthing.core.AacCsd
import app.wifisoundthing.core.AudioConfig
import app.wifisoundthing.core.AudioPacketCodec
import app.wifisoundthing.core.Format
import app.wifisoundthing.core.Protocol
import app.wifisoundthing.net.Discovery
import app.wifisoundthing.net.HostServer
import app.wifisoundthing.ui.HostActivity
import java.util.concurrent.atomic.AtomicLong

/**
 * Foreground service (type mediaProjection) that runs the whole host pipeline:
 * playback capture -> AAC encode -> UDP fan-out + TCP control + NSD advertising.
 * Keeps running with the app in the background and the screen off (FR-5).
 */
class HostService : Service() {

    private var mediaProjection: MediaProjection? = null
    private var captureEngine: CaptureEngine? = null
    private var server: HostServer? = null
    private var advertiser: Discovery.Advertiser? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private val handler = Handler(Looper.getMainLooper())
    private val sequence = AtomicLong(0)
    private var running = false

    private val projectionCallback = object : MediaProjection.Callback() {
        override fun onStop() {
            // System or user revoked the capture session (e.g. via the status bar).
            if (running) {
                HostSession.postError(getString(R.string.host_error_projection_stopped))
                stopEverything()
            }
        }
    }

    private val statsUpdater = object : Runnable {
        override fun run() {
            val srv = server ?: return
            HostSession.clientCount = srv.clientCount
            HostSession.totalBytesSent = srv.sendMeter.totalBytes
            HostSession.bitsPerSecond = srv.sendMeter.bitsPerSecond(System.currentTimeMillis())
            HostSession.displayAddress = NetInfo.displayAddress()
            updateNotification()
            handler.postDelayed(this, STATS_INTERVAL_MS)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> if (!running) startHosting(intent)
            ACTION_STOP -> stopEverything()
        }
        return START_NOT_STICKY
    }

    private fun startHosting(intent: Intent) {
        createChannel()
        // On Android 14+ the service must be in the foreground with type
        // mediaProjection *before* the projection may be obtained.
        startForeground(
            NOTIFICATION_ID,
            buildNotification(getString(R.string.host_notification_starting)),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION,
        )

        val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, Int.MIN_VALUE)
        @Suppress("DEPRECATION")
        val resultData: Intent? = if (Build.VERSION.SDK_INT >= 33) {
            intent.getParcelableExtra(EXTRA_RESULT_DATA, Intent::class.java)
        } else {
            intent.getParcelableExtra(EXTRA_RESULT_DATA)
        }
        if (resultCode == Int.MIN_VALUE || resultData == null) {
            fail(getString(R.string.host_error_no_permission))
            return
        }

        val projection = try {
            val manager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            manager.getMediaProjection(resultCode, resultData)
        } catch (e: Exception) {
            Log.e(TAG, "getMediaProjection failed", e)
            null
        }
        if (projection == null) {
            fail(getString(R.string.host_error_no_permission))
            return
        }
        projection.registerCallback(projectionCallback, handler)
        mediaProjection = projection

        val bitrate = intent.getIntExtra(EXTRA_BITRATE, Prefs.DEFAULT_BITRATE)
        val audioConfig = AudioConfig(
            sampleRate = SAMPLE_RATE,
            channelCount = CHANNELS,
            codec = Protocol.CODEC_AAC_LC,
            csd = AacCsd.audioSpecificConfig(SAMPLE_RATE, CHANNELS),
        )

        val srv = HostServer(
            controlPort = Protocol.DEFAULT_CONTROL_PORT,
            audioConfig = audioConfig,
            listener = object : HostServer.Listener {
                override fun onClientCountChanged(count: Int) {
                    HostSession.clientCount = count
                    handler.post { updateNotification() }
                }

                override fun onServerError(message: String) {
                    HostSession.postError(message)
                    handler.post { stopEverything() }
                }
            },
        )
        try {
            srv.start()
        } catch (e: Exception) {
            Log.e(TAG, "Server start failed", e)
            fail(getString(R.string.host_error_port, Protocol.DEFAULT_CONTROL_PORT, e.message ?: ""))
            return
        }
        server = srv

        val capture = CaptureEngine(
            mediaProjection = projection,
            sampleRate = SAMPLE_RATE,
            channelCount = CHANNELS,
            bitrate = bitrate,
            onFrame = { frame, ptsUs ->
                srv.broadcast(AudioPacketCodec.encode(sequence.getAndIncrement(), ptsUs, frame))
            },
            onError = { message ->
                HostSession.postError(message)
                handler.post { stopEverything() }
            },
        )
        capture.start()
        captureEngine = capture

        advertiser = Discovery.Advertiser(
            this,
            getString(R.string.discovery_service_name, Build.MODEL),
            Protocol.DEFAULT_CONTROL_PORT,
        ).also { it.start() }

        acquireLocks()

        running = true
        sequence.set(0)
        HostSession.resetStats()
        HostSession.state = HostSession.State.RUNNING
        HostSession.startedAtMs = System.currentTimeMillis()
        HostSession.controlPort = Protocol.DEFAULT_CONTROL_PORT
        HostSession.displayAddress = NetInfo.displayAddress()
        handler.post(statsUpdater)
        Log.i(TAG, "Hosting started on port ${Protocol.DEFAULT_CONTROL_PORT}")
    }

    private fun fail(message: String) {
        HostSession.postError(message)
        stopEverything()
    }

    private fun stopEverything() {
        handler.removeCallbacks(statsUpdater)
        running = false
        advertiser?.stop()
        advertiser = null
        captureEngine?.stop()
        captureEngine = null
        server?.stop()
        server = null
        mediaProjection?.let {
            try {
                it.unregisterCallback(projectionCallback)
                it.stop()
            } catch (_: Exception) {
            }
        }
        mediaProjection = null
        releaseLocks()
        HostSession.state = HostSession.State.IDLE
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        if (running) stopEverything()
        super.onDestroy()
    }

    private fun acquireLocks() {
        val power = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "WiFiSoundThing:host").apply {
            setReferenceCounted(false)
            acquire(WAKELOCK_TIMEOUT_MS)
        }
        val wifi = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        wifiLock = wifi.createWifiLock(WifiManager.WIFI_MODE_FULL_LOW_LATENCY, "WiFiSoundThing:host").apply {
            setReferenceCounted(false)
            acquire()
        }
    }

    private fun releaseLocks() {
        try {
            wakeLock?.release()
        } catch (_: Exception) {
        }
        wakeLock = null
        try {
            wifiLock?.release()
        } catch (_: Exception) {
        }
        wifiLock = null
    }

    private fun createChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.host_channel_name),
            NotificationManager.IMPORTANCE_LOW,
        )
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
    }

    private fun buildNotification(text: String): Notification {
        val openIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, HostActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val stopIntent = PendingIntent.getService(
            this,
            1,
            Intent(this, HostService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(getString(R.string.host_notification_title))
            .setContentText(text)
            .setContentIntent(openIntent)
            .addAction(0, getString(R.string.action_stop), stopIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
    }

    private fun updateNotification() {
        if (!running) return
        val uptime = Format.duration(System.currentTimeMillis() - HostSession.startedAtMs)
        val text = getString(
            R.string.host_notification_status,
            HostSession.clientCount,
            uptime,
            Format.bytes(HostSession.totalBytesSent),
        )
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildNotification(text))
    }

    companion object {
        private const val TAG = "HostService"
        private const val CHANNEL_ID = "host"
        private const val NOTIFICATION_ID = 1
        private const val STATS_INTERVAL_MS = 2000L
        private const val WAKELOCK_TIMEOUT_MS = 6 * 60 * 60 * 1000L // safety cap: 6 hours

        const val ACTION_START = "app.wifisoundthing.host.START"
        const val ACTION_STOP = "app.wifisoundthing.host.STOP"
        const val EXTRA_RESULT_CODE = "result_code"
        const val EXTRA_RESULT_DATA = "result_data"
        const val EXTRA_BITRATE = "bitrate"

        const val SAMPLE_RATE = 48_000
        const val CHANNELS = 2

        fun start(context: Context, resultCode: Int, resultData: Intent, bitrate: Int) {
            val intent = Intent(context, HostService::class.java)
                .setAction(ACTION_START)
                .putExtra(EXTRA_RESULT_CODE, resultCode)
                .putExtra(EXTRA_RESULT_DATA, resultData)
                .putExtra(EXTRA_BITRATE, bitrate)
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            context.startService(Intent(context, HostService::class.java).setAction(ACTION_STOP))
        }
    }
}
