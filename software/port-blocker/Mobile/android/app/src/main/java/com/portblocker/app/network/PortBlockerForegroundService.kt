package com.portblocker.app.network

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.portblocker.app.MainActivity
import com.portblocker.app.R

class PortBlockerForegroundService : Service() {
    private var isForeground = false
    private val publishedBlockerNotificationIds = mutableSetOf<Int>()

    private val statusListener: (BlockerState) -> Unit = {
        refreshNotification()
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        PortBlockerRegistry.addStatusListener(statusListener)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val blockerId = intent?.getStringExtra(EXTRA_BLOCKER_ID)

        try {
            when (intent?.action) {
                ACTION_PAUSE_ONE -> {
                    if (blockerId != null) {
                        PortBlockerRegistry.pauseBlocker(blockerId)
                    }
                }
                ACTION_RESUME_ONE -> {
                    if (blockerId != null) {
                        PortBlockerRegistry.resumeBlocker(blockerId)
                    }
                }
                ACTION_STOP_ONE -> {
                    if (blockerId != null) {
                        PortBlockerRegistry.stopBlocker(blockerId)
                    }
                }
            }
        } catch (_: Exception) {
            // Best effort: blocker may already be gone when the user taps a stale notification action.
        }

        refreshNotification()
        return START_STICKY
    }

    override fun onDestroy() {
        PortBlockerRegistry.removeStatusListener(statusListener)
        cancelPublishedBlockerNotifications()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun refreshNotification() {
        val blockers = PortBlockerRegistry.getBlockers()
            .filter { it.status != BlockerStatus.STOPPED }

        if (blockers.isEmpty()) {
            cancelPublishedBlockerNotifications()
            stopForegroundCompat()
            stopSelf()
            return
        }

        val foregroundBlocker = blockers.first()
        val notification = buildForegroundNotification(foregroundBlocker)
        if (!isForeground) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
            isForeground = true
        }

        val notificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, notification)
        refreshBlockerNotifications(notificationManager, blockers, foregroundBlocker.id)
    }

    private fun stopForegroundCompat() {
        if (!isForeground) {
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        isForeground = false
    }

    private fun buildForegroundNotification(blocker: BlockerState): Notification {
        return buildBlockerNotification(blocker)
    }

    private fun refreshBlockerNotifications(
        notificationManager: NotificationManager,
        blockers: List<BlockerState>,
        foregroundBlockerId: String,
    ) {
        val nextIds = mutableSetOf<Int>()

        blockers.forEach { blocker ->
            if (blocker.id == foregroundBlockerId) {
                return@forEach
            }

            val notificationId = blockerNotificationId(blocker)
            nextIds.add(notificationId)
            notificationManager.notify(notificationId, buildBlockerNotification(blocker))
        }

        publishedBlockerNotificationIds
            .filter { it !in nextIds }
            .forEach(notificationManager::cancel)

        publishedBlockerNotificationIds.clear()
        publishedBlockerNotificationIds.addAll(nextIds)
    }

    private fun buildBlockerNotification(blocker: BlockerState): Notification {
        val statusText = when (blocker.status) {
            BlockerStatus.LISTENING -> "Blocking active"
            BlockerStatus.PAUSED -> "Blocking paused"
            BlockerStatus.ERROR -> blocker.errorMessage ?: "Blocking error"
            BlockerStatus.STOPPED -> "Blocking stopped"
        }

        val detail = buildString {
            append(statusText)
            if (blocker.connectionsCount > 0) {
                append(" • Connections: ${blocker.connectionsCount}")
            }
            if (blocker.bytesReceived > 0) {
                append(" • Data: ${blocker.bytesReceived} B")
            }
        }

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle(formatBlocker(blocker))
            .setContentText(detail)
            .setContentIntent(createContentIntent())
            .setDeleteIntent(
                createSyncIntent(blockerNotificationId(blocker) + REQUEST_SYNC_OFFSET),
            )
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

        if (blocker.status == BlockerStatus.LISTENING) {
            builder.addAction(
                android.R.drawable.ic_media_pause,
                "Pause",
                createBlockerActionIntent(
                    ACTION_PAUSE_ONE,
                    blocker.id,
                    blockerNotificationId(blocker) + REQUEST_PAUSE_OFFSET,
                ),
            )
        } else if (blocker.status == BlockerStatus.PAUSED || blocker.status == BlockerStatus.ERROR) {
            builder.addAction(
                android.R.drawable.ic_media_play,
                "Resume",
                createBlockerActionIntent(
                    ACTION_RESUME_ONE,
                    blocker.id,
                    blockerNotificationId(blocker) + REQUEST_RESUME_OFFSET,
                ),
            )
        }

        builder.addAction(
            android.R.drawable.ic_menu_close_clear_cancel,
            "Stop",
            createBlockerActionIntent(
                ACTION_STOP_ONE,
                blocker.id,
                blockerNotificationId(blocker) + REQUEST_STOP_OFFSET,
            ),
        )

        return builder.build().apply {
            flags = flags or Notification.FLAG_NO_CLEAR or Notification.FLAG_ONGOING_EVENT
        }
    }

    private fun formatBlocker(blocker: BlockerState): String {
        return "${blocker.protocol.uppercase()} ${blocker.port}"
    }

    private fun createContentIntent(): PendingIntent {
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }

        return PendingIntent.getActivity(
            this,
            REQUEST_OPEN_APP,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun createBlockerActionIntent(
        action: String,
        blockerId: String,
        requestCode: Int,
    ): PendingIntent {
        val intent = Intent(this, PortBlockerForegroundService::class.java).apply {
            this.action = action
            putExtra(EXTRA_BLOCKER_ID, blockerId)
        }

        return PendingIntent.getService(
            this,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun createSyncIntent(requestCode: Int): PendingIntent {
        val intent = Intent(this, PortBlockerForegroundService::class.java).apply {
            action = ACTION_SYNC
        }

        return PendingIntent.getService(
            this,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return
        }

        val notificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (notificationManager.getNotificationChannel(CHANNEL_ID) != null) {
            return
        }

        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.notification_channel_name),
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = getString(R.string.notification_channel_description)
            setShowBadge(false)
        }

        notificationManager.createNotificationChannel(channel)
    }

    private fun cancelPublishedBlockerNotifications() {
        val notificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        publishedBlockerNotificationIds.forEach(notificationManager::cancel)
        publishedBlockerNotificationIds.clear()
    }

    private fun blockerNotificationId(blocker: BlockerState): Int {
        return BLOCKER_NOTIFICATION_ID_BASE + (blocker.id.hashCode().ushr(1) % 100_000)
    }

    companion object {
        private const val CHANNEL_ID = "port_blocker_active"
        private const val NOTIFICATION_ID = 88985678
        private const val BLOCKER_NOTIFICATION_ID_BASE = 88_900_000
        private const val ACTION_SYNC = "com.portblocker.app.action.SYNC"
        private const val ACTION_PAUSE_ONE = "com.portblocker.app.action.PAUSE_ONE"
        private const val ACTION_RESUME_ONE = "com.portblocker.app.action.RESUME_ONE"
        private const val ACTION_STOP_ONE = "com.portblocker.app.action.STOP_ONE"
        private const val EXTRA_BLOCKER_ID = "blockerId"
        private const val REQUEST_OPEN_APP = 1
        private const val REQUEST_PAUSE_OFFSET = 2_000
        private const val REQUEST_RESUME_OFFSET = 4_000
        private const val REQUEST_STOP_OFFSET = 6_000
        private const val REQUEST_SYNC_OFFSET = 8_000

        fun sync(context: Context) {
            val serviceIntent = Intent(context, PortBlockerForegroundService::class.java).apply {
                action = ACTION_SYNC
            }

            if (PortBlockerRegistry.hasBlockers()) {
                ContextCompat.startForegroundService(context, serviceIntent)
            } else {
                context.stopService(serviceIntent)
            }
        }
    }
}
