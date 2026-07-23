package com.fable.wifisoundthing.client

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.wifi.WifiManager
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.fable.wifisoundthing.R
import com.fable.wifisoundthing.state.ClientPhase
import com.fable.wifisoundthing.state.ClientStateHolder
import com.fable.wifisoundthing.ui.ClientActivity
import com.fable.wifisoundthing.util.Prefs
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

/**
 * Foreground service (type mediaPlayback) that owns the [ClientSession] so playback keeps
 * running with the screen off and survives brief network drops via auto-reconnect.
 */
class ClientService : Service() {

    private var session: ClientSession? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var notificationJob: Job? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_CONNECT -> handleConnect(intent)
            ACTION_DISCONNECT -> {
                teardown()
                ClientStateHolder.reset()
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    private fun handleConnect(intent: Intent) {
        val host = intent.getStringExtra(EXTRA_HOST) ?: return
        val port = intent.getIntExtra(EXTRA_PORT, 0)
        if (port !in 1..65535) return

        createChannel()
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            buildNotification(getString(R.string.notif_client_connecting, host)),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
        )

        // A new connect request replaces any current session.
        session?.stop()

        acquireLocks()
        val prefs = Prefs(this)
        session = ClientSession(
            hostAddress = host,
            hostPort = port,
            deviceName = prefs.deviceName,
            targetBufferMs = when (prefs.bufferPreset) {
                "low" -> 40
                "safe" -> 120
                else -> 60
            },
        ).also { it.start() }

        if (notificationJob == null) {
            notificationJob = scope.launch {
                ClientStateHolder.state.collectLatest { state ->
                    val text = when (state.phase) {
                        ClientPhase.CONNECTED ->
                            getString(R.string.notif_client_connected, state.hostName ?: host)
                        ClientPhase.RECONNECTING -> getString(R.string.notif_client_reconnecting)
                        else -> getString(R.string.notif_client_connecting, host)
                    }
                    (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
                        .notify(NOTIFICATION_ID, buildNotification(text))
                }
            }
        }
    }

    private fun acquireLocks() {
        if (wifiLock != null) return
        val wifi = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        wifiLock = wifi.createWifiLock(WifiManager.WIFI_MODE_FULL_LOW_LATENCY, "wst:client").apply {
            setReferenceCounted(false)
            acquire()
        }
        val power = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "wst:client").apply {
            setReferenceCounted(false)
            acquire()
        }
    }

    private fun teardown() {
        notificationJob?.cancel()
        notificationJob = null
        session?.stop()
        session = null
        try {
            wifiLock?.release()
        } catch (_: Exception) {
        }
        try {
            wakeLock?.release()
        } catch (_: Exception) {
        }
        wifiLock = null
        wakeLock = null
    }

    override fun onDestroy() {
        teardown()
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.notif_channel_client),
            NotificationManager.IMPORTANCE_LOW,
        )
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
            .createNotificationChannel(channel)
    }

    private fun buildNotification(text: String): Notification {
        val openIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, ClientActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE,
        )
        val disconnectIntent = PendingIntent.getService(
            this, 1,
            Intent(this, ClientService::class.java).setAction(ACTION_DISCONNECT),
            PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_wave)
            .setContentTitle(getString(R.string.notif_client_title))
            .setContentText(text)
            .setContentIntent(openIntent)
            .setOngoing(true)
            .addAction(0, getString(R.string.action_disconnect), disconnectIntent)
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "client_playback"
        private const val NOTIFICATION_ID = 2
        const val ACTION_CONNECT = "com.fable.wifisoundthing.client.CONNECT"
        const val ACTION_DISCONNECT = "com.fable.wifisoundthing.client.DISCONNECT"
        const val EXTRA_HOST = "host"
        const val EXTRA_PORT = "port"

        fun connect(context: Context, host: String, port: Int) {
            val intent = Intent(context, ClientService::class.java)
                .setAction(ACTION_CONNECT)
                .putExtra(EXTRA_HOST, host)
                .putExtra(EXTRA_PORT, port)
            context.startForegroundService(intent)
        }

        fun disconnect(context: Context) {
            context.startService(
                Intent(context, ClientService::class.java).setAction(ACTION_DISCONNECT)
            )
        }
    }
}
