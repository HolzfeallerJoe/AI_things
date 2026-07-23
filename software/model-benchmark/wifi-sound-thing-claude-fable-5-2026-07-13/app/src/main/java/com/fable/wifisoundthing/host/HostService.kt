package com.fable.wifisoundthing.host

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
import android.os.Handler
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.fable.wifisoundthing.R
import com.fable.wifisoundthing.state.HostStateHolder
import com.fable.wifisoundthing.ui.HostActivity
import com.fable.wifisoundthing.util.Prefs

/**
 * Foreground service (type mediaProjection) that owns the [HostSession] so capture and
 * streaming keep running with the app in the background and the screen off (FR-5).
 */
class HostService : Service() {

    private var session: HostSession? = null
    private var projection: MediaProjection? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private var multicastLock: WifiManager.MulticastLock? = null
    private var wakeLock: PowerManager.WakeLock? = null

    private val projectionCallback = object : MediaProjection.Callback() {
        override fun onStop() {
            // System or user revoked the capture (e.g. from the status bar tile).
            teardown()
            HostStateHolder.reset(
                error = "Screen/audio capture was stopped by the system. Press Start to broadcast again."
            )
            stopSelf()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> handleStart(intent)
            ACTION_STOP -> {
                teardown()
                HostStateHolder.reset()
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    private fun handleStart(intent: Intent) {
        if (session != null) return // already broadcasting

        createChannel()
        // The service must be in the foreground with the mediaProjection type before the
        // projection may be used (required on Android 14+).
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            buildNotification(getString(R.string.notif_host_starting)),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION,
        )

        val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0)
        val resultData = getParcelableExtraCompat(intent)
        if (resultData == null) {
            HostStateHolder.reset(error = "Screen capture permission was not granted.")
            stopSelf()
            return
        }
        val manager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        val proj = try {
            manager.getMediaProjection(resultCode, resultData)
        } catch (_: Exception) {
            null
        }
        if (proj == null) {
            HostStateHolder.reset(error = "Screen capture permission was not granted.")
            stopSelf()
            return
        }
        projection = proj
        proj.registerCallback(projectionCallback, Handler(mainLooper))

        acquireLocks()

        val prefs = Prefs(this)
        val newSession = HostSession(
            projection = proj,
            hostName = prefs.deviceName,
            controlPort = prefs.controlPort,
            codecMode = prefs.codecMode,
            onClientCountChanged = { count -> updateNotification(count) },
        )
        val error = newSession.start()
        if (error != null) {
            proj.unregisterCallback(projectionCallback)
            proj.stop()
            projection = null
            releaseLocks()
            HostStateHolder.reset(error = error)
            stopSelf()
            return
        }
        session = newSession
        updateNotification(0)
    }

    private fun acquireLocks() {
        val wifi = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        wifiLock = wifi.createWifiLock(WifiManager.WIFI_MODE_FULL_LOW_LATENCY, "wst:host").apply {
            setReferenceCounted(false)
            acquire()
        }
        multicastLock = wifi.createMulticastLock("wst:discovery").apply {
            setReferenceCounted(false)
            acquire()
        }
        val power = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "wst:host").apply {
            setReferenceCounted(false)
            acquire()
        }
    }

    private fun releaseLocks() {
        try {
            wifiLock?.release()
        } catch (_: Exception) {
        }
        try {
            multicastLock?.release()
        } catch (_: Exception) {
        }
        try {
            wakeLock?.release()
        } catch (_: Exception) {
        }
        wifiLock = null
        multicastLock = null
        wakeLock = null
    }

    private fun teardown() {
        session?.stop()
        session = null
        projection?.let {
            try {
                it.unregisterCallback(projectionCallback)
            } catch (_: Exception) {
            }
            try {
                it.stop()
            } catch (_: Exception) {
            }
        }
        projection = null
        releaseLocks()
    }

    override fun onDestroy() {
        teardown()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.notif_channel_host),
            NotificationManager.IMPORTANCE_LOW,
        )
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
            .createNotificationChannel(channel)
    }

    private fun buildNotification(text: String): Notification {
        val openIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, HostActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE,
        )
        val stopIntent = PendingIntent.getService(
            this, 1,
            Intent(this, HostService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_wave)
            .setContentTitle(getString(R.string.notif_host_title))
            .setContentText(text)
            .setContentIntent(openIntent)
            .setOngoing(true)
            .addAction(0, getString(R.string.action_stop), stopIntent)
            .build()
    }

    private fun updateNotification(clientCount: Int) {
        val text = resources.getQuantityString(
            R.plurals.notif_host_listeners, clientCount, clientCount
        )
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
            .notify(NOTIFICATION_ID, buildNotification(text))
    }

    @Suppress("DEPRECATION")
    private fun getParcelableExtraCompat(intent: Intent): Intent? =
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            intent.getParcelableExtra(EXTRA_RESULT_DATA, Intent::class.java)
        } else {
            intent.getParcelableExtra(EXTRA_RESULT_DATA)
        }

    companion object {
        private const val CHANNEL_ID = "host_broadcast"
        private const val NOTIFICATION_ID = 1
        const val ACTION_START = "com.fable.wifisoundthing.host.START"
        const val ACTION_STOP = "com.fable.wifisoundthing.host.STOP"
        const val EXTRA_RESULT_CODE = "resultCode"
        const val EXTRA_RESULT_DATA = "resultData"

        fun start(context: Context, resultCode: Int, resultData: Intent) {
            val intent = Intent(context, HostService::class.java)
                .setAction(ACTION_START)
                .putExtra(EXTRA_RESULT_CODE, resultCode)
                .putExtra(EXTRA_RESULT_DATA, resultData)
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            context.startService(
                Intent(context, HostService::class.java).setAction(ACTION_STOP)
            )
        }
    }
}
