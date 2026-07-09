package app.wifisoundthing.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import app.wifisoundthing.R
import app.wifisoundthing.app.ClientSession
import app.wifisoundthing.core.JitterBuffer
import app.wifisoundthing.core.Protocol
import app.wifisoundthing.net.ClientEngine
import app.wifisoundthing.ui.ClientActivity

/**
 * Foreground service (type mediaPlayback) that receives and plays the stream,
 * so playback continues with the screen off or the app in the background.
 */
class ClientService : Service() {

    private var engine: ClientEngine? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private val handler = Handler(Looper.getMainLooper())
    private var running = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                stopEngineOnly() // allow switching hosts without restarting the service
                startListening(intent)
            }
            ACTION_STOP -> stopEverything()
        }
        return START_NOT_STICKY
    }

    private fun startListening(intent: Intent) {
        val host = intent.getStringExtra(EXTRA_HOST) ?: return stopEverything()
        val port = intent.getIntExtra(EXTRA_PORT, Protocol.DEFAULT_CONTROL_PORT)
        val label = intent.getStringExtra(EXTRA_LABEL) ?: host
        val jitterDepth = intent.getIntExtra(EXTRA_JITTER_DEPTH, JitterBuffer.DEFAULT_TARGET_DEPTH)

        createChannel()
        startForeground(
            NOTIFICATION_ID,
            buildNotification(getString(R.string.client_state_connecting, label)),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
        )
        acquireLocks()

        ClientSession.hostLabel = label
        ClientSession.stats = null

        val newEngine = ClientEngine(
            hostAddress = host,
            controlPort = port,
            clientName = Build.MODEL ?: "Android",
            jitterDepth = jitterDepth,
            listener = object : ClientEngine.Listener {
                override fun onStateChanged(state: ClientEngine.State, detail: String?) {
                    ClientSession.state = state
                    ClientSession.stateDetail = detail
                    if (detail != null && state != ClientEngine.State.STOPPED) {
                        ClientSession.postError(detail)
                    }
                    handler.post { updateNotification(state, label) }
                }

                override fun onStatsUpdated(stats: ClientEngine.Stats) {
                    ClientSession.stats = stats
                }
            },
        )
        engine = newEngine
        newEngine.start()
        running = true
    }

    private fun stopEngineOnly() {
        engine?.let { current ->
            engine = null
            // Engine teardown does blocking joins; keep it off the main thread.
            Thread { current.stop() }.start()
        }
    }

    private fun stopEverything() {
        running = false
        stopEngineOnly()
        releaseLocks()
        ClientSession.state = ClientEngine.State.STOPPED
        ClientSession.stateDetail = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        if (running) stopEverything()
        super.onDestroy()
    }

    private fun acquireLocks() {
        if (wakeLock == null) {
            val power = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "WiFiSoundThing:client").apply {
                setReferenceCounted(false)
                acquire(WAKELOCK_TIMEOUT_MS)
            }
        }
        if (wifiLock == null) {
            val wifi = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            wifiLock = wifi.createWifiLock(WifiManager.WIFI_MODE_FULL_LOW_LATENCY, "WiFiSoundThing:client").apply {
                setReferenceCounted(false)
                acquire()
            }
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
            getString(R.string.client_channel_name),
            NotificationManager.IMPORTANCE_LOW,
        )
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
    }

    private fun buildNotification(text: String): Notification {
        val openIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, ClientActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val stopIntent = PendingIntent.getService(
            this,
            1,
            Intent(this, ClientService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(getString(R.string.client_notification_title))
            .setContentText(text)
            .setContentIntent(openIntent)
            .addAction(0, getString(R.string.action_disconnect), stopIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
    }

    private fun updateNotification(state: ClientEngine.State, label: String) {
        if (!running && state != ClientEngine.State.CONNECTING) return
        val text = when (state) {
            ClientEngine.State.CONNECTING -> getString(R.string.client_state_connecting, label)
            ClientEngine.State.BUFFERING -> getString(R.string.client_state_buffering)
            ClientEngine.State.PLAYING -> getString(R.string.client_state_playing, label)
            ClientEngine.State.RECONNECTING -> getString(R.string.client_state_reconnecting)
            ClientEngine.State.FAILED -> getString(R.string.client_state_failed)
            ClientEngine.State.STOPPED -> getString(R.string.client_state_stopped)
        }
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildNotification(text))
    }

    companion object {
        private const val CHANNEL_ID = "client"
        private const val NOTIFICATION_ID = 2
        private const val WAKELOCK_TIMEOUT_MS = 6 * 60 * 60 * 1000L

        const val ACTION_START = "app.wifisoundthing.client.START"
        const val ACTION_STOP = "app.wifisoundthing.client.STOP"
        const val EXTRA_HOST = "host"
        const val EXTRA_PORT = "port"
        const val EXTRA_LABEL = "label"
        const val EXTRA_JITTER_DEPTH = "jitter_depth"

        fun start(context: Context, host: String, port: Int, label: String, jitterDepth: Int) {
            val intent = Intent(context, ClientService::class.java)
                .setAction(ACTION_START)
                .putExtra(EXTRA_HOST, host)
                .putExtra(EXTRA_PORT, port)
                .putExtra(EXTRA_LABEL, label)
                .putExtra(EXTRA_JITTER_DEPTH, jitterDepth)
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            context.startService(Intent(context, ClientService::class.java).setAction(ACTION_STOP))
        }
    }
}
