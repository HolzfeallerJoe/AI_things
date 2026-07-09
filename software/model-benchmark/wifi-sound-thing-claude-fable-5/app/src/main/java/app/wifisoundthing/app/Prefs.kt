package app.wifisoundthing.app

import android.content.Context
import android.content.SharedPreferences
import app.wifisoundthing.core.JitterBuffer

/**
 * Persists the last-used configuration across app restarts (FR-10).
 */
class Prefs(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("wifi_sound_thing", Context.MODE_PRIVATE)

    /** "host" or "client"; used to preselect the last role. */
    var lastRole: String?
        get() = prefs.getString(KEY_ROLE, null)
        set(value) = prefs.edit().putString(KEY_ROLE, value).apply()

    /** Host: AAC bitrate in bits/second. */
    var hostBitrate: Int
        get() = prefs.getInt(KEY_BITRATE, DEFAULT_BITRATE)
        set(value) = prefs.edit().putInt(KEY_BITRATE, value).apply()

    /** Client: jitter buffer depth in packets (~21 ms each). */
    var jitterDepth: Int
        get() = prefs.getInt(KEY_JITTER_DEPTH, JitterBuffer.DEFAULT_TARGET_DEPTH)
        set(value) = prefs.edit().putInt(KEY_JITTER_DEPTH, value).apply()

    /** Client: last manually entered host address ("ip" or "ip:port"). */
    var lastManualAddress: String
        get() = prefs.getString(KEY_MANUAL_ADDRESS, "") ?: ""
        set(value) = prefs.edit().putString(KEY_MANUAL_ADDRESS, value).apply()

    companion object {
        private const val KEY_ROLE = "last_role"
        private const val KEY_BITRATE = "host_bitrate"
        private const val KEY_JITTER_DEPTH = "jitter_depth"
        private const val KEY_MANUAL_ADDRESS = "manual_address"

        const val DEFAULT_BITRATE = 160_000

        val BITRATE_OPTIONS = intArrayOf(96_000, 160_000, 256_000)
        val JITTER_OPTIONS = intArrayOf(3, 5, 10) // ~64 ms / ~107 ms / ~213 ms of buffer
    }
}
