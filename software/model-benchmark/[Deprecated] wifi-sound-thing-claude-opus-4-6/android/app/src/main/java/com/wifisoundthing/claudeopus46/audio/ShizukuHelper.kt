package com.wifisoundthing.claudeopus46.audio

import android.content.ComponentName
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.util.Log
import rikka.shizuku.Shizuku
import rikka.shizuku.Shizuku.UserServiceArgs

/**
 * Helper for all Shizuku interactions: availability checks, permission
 * requests, and binding the [RemoteAudioCaptureService] UserService.
 */
object ShizukuHelper {

    private const val TAG = "ShizukuHelper"

    // ── Status checks ────────────────────────────────────────────────

    /** True when Shizuku binder is alive (the Shizuku app is running). */
    fun isRunning(): Boolean {
        return try {
            Shizuku.pingBinder()
        } catch (e: Exception) {
            false
        }
    }

    /** True when our app already has permission to use Shizuku APIs. */
    fun hasPermission(): Boolean {
        return try {
            if (!isRunning()) false
            else Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED
        } catch (e: Exception) {
            false
        }
    }

    // ── Permission request ───────────────────────────────────────────

    /**
     * Request Shizuku permission. The result is delivered via the
     * [Shizuku.OnRequestPermissionResultListener] registered by the caller.
     */
    fun requestPermission(requestCode: Int) {
        Shizuku.requestPermission(requestCode)
    }

    fun addPermissionResultListener(listener: Shizuku.OnRequestPermissionResultListener) {
        Shizuku.addRequestPermissionResultListener(listener)
    }

    fun removePermissionResultListener(listener: Shizuku.OnRequestPermissionResultListener) {
        Shizuku.removeRequestPermissionResultListener(listener)
    }

    // ── Binder lifecycle listeners ───────────────────────────────────

    fun addBinderReceivedListener(listener: Shizuku.OnBinderReceivedListener) {
        Shizuku.addBinderReceivedListener(listener)
    }

    fun removeBinderReceivedListener(listener: Shizuku.OnBinderReceivedListener) {
        Shizuku.removeBinderReceivedListener(listener)
    }

    fun addBinderDeadListener(listener: Shizuku.OnBinderDeadListener) {
        Shizuku.addBinderDeadListener(listener)
    }

    fun removeBinderDeadListener(listener: Shizuku.OnBinderDeadListener) {
        Shizuku.removeBinderDeadListener(listener)
    }

    // ── UserService binding ──────────────────────────────────────────

    /**
     * Bind the [RemoteAudioCaptureService] as a Shizuku UserService.
     * The service runs in a separate process as UID 2000 (shell).
     *
     * @param connection ServiceConnection that receives the [IRemoteAudioCapture] binder
     */
    fun bindAudioCaptureService(connection: ServiceConnection) {
        val args = UserServiceArgs(
            ComponentName(
                "com.wifisoundthing.claudeopus46",
                RemoteAudioCaptureService::class.java.name
            )
        )
            .daemon(false)        // stop when our app unbinds
            .processNameSuffix("audio_capture")
            .debuggable(false)
            .version(1)

        try {
            Shizuku.bindUserService(args, connection)
            Log.d(TAG, "bindUserService called")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to bind UserService: $e")
        }
    }

    /**
     * Unbind the [RemoteAudioCaptureService].
     */
    fun unbindAudioCaptureService(connection: ServiceConnection) {
        try {
            Shizuku.unbindUserService(
                UserServiceArgs(
                    ComponentName(
                        "com.wifisoundthing.claudeopus46",
                        RemoteAudioCaptureService::class.java.name
                    )
                ),
                connection,
                true
            )
        } catch (e: Exception) {
            Log.w(TAG, "Error unbinding UserService: $e")
        }
    }
}
