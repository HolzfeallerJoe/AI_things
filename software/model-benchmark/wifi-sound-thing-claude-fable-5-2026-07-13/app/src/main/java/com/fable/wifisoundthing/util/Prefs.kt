package com.fable.wifisoundthing.util

import android.content.Context
import android.os.Build
import com.fable.wifisoundthing.protocol.Wire

/** Persisted settings (FR-10): last-used values survive app restarts. */
class Prefs(context: Context) {
    private val sp = context.applicationContext
        .getSharedPreferences("settings", Context.MODE_PRIVATE)

    var deviceName: String
        get() = sp.getString(KEY_DEVICE_NAME, null) ?: defaultDeviceName()
        set(value) = sp.edit().putString(KEY_DEVICE_NAME, value.trim()).apply()

    /** "auto" = Opus if the device supports it, "pcm" = force uncompressed. */
    var codecMode: String
        get() = sp.getString(KEY_CODEC_MODE, "auto") ?: "auto"
        set(value) = sp.edit().putString(KEY_CODEC_MODE, value).apply()

    var lastHostAddress: String
        get() = sp.getString(KEY_LAST_HOST, "") ?: ""
        set(value) = sp.edit().putString(KEY_LAST_HOST, value.trim()).apply()

    /** "low" | "normal" | "safe" — client jitter buffer size. */
    var bufferPreset: String
        get() = sp.getString(KEY_BUFFER_PRESET, "normal") ?: "normal"
        set(value) = sp.edit().putString(KEY_BUFFER_PRESET, value).apply()

    var controlPort: Int
        get() = sp.getInt(KEY_CONTROL_PORT, Wire.DEFAULT_CONTROL_PORT)
        set(value) = sp.edit().putInt(KEY_CONTROL_PORT, value).apply()

    fun prebufferPackets(): Int = when (bufferPreset) {
        "low" -> 2
        "safe" -> 6
        else -> 3
    }

    private fun defaultDeviceName(): String =
        Build.MODEL?.takeIf { it.isNotBlank() } ?: "Android"

    companion object {
        private const val KEY_DEVICE_NAME = "deviceName"
        private const val KEY_CODEC_MODE = "codecMode"
        private const val KEY_LAST_HOST = "lastHostAddress"
        private const val KEY_BUFFER_PRESET = "bufferPreset"
        private const val KEY_CONTROL_PORT = "controlPort"
    }
}
