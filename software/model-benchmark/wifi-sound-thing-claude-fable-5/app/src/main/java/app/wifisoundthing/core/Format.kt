package app.wifisoundthing.core

import java.util.Locale

/** Human-readable formatting used by both host and client status screens. */
object Format {
    fun bytes(count: Long): String = when {
        count < 1024 -> "$count B"
        count < 1024 * 1024 -> String.format(Locale.US, "%.1f KB", count / 1024.0)
        count < 1024L * 1024 * 1024 -> String.format(Locale.US, "%.1f MB", count / (1024.0 * 1024))
        else -> String.format(Locale.US, "%.2f GB", count / (1024.0 * 1024 * 1024))
    }

    fun bitrate(bitsPerSecond: Long): String = when {
        bitsPerSecond < 1000 -> "$bitsPerSecond bps"
        bitsPerSecond < 1_000_000 -> String.format(Locale.US, "%.0f kbps", bitsPerSecond / 1000.0)
        else -> String.format(Locale.US, "%.1f Mbps", bitsPerSecond / 1_000_000.0)
    }

    /** Formats a duration as m:ss or h:mm:ss. */
    fun duration(ms: Long): String {
        val totalSeconds = (ms / 1000).coerceAtLeast(0)
        val h = totalSeconds / 3600
        val m = (totalSeconds % 3600) / 60
        val s = totalSeconds % 60
        return if (h > 0) {
            String.format(Locale.US, "%d:%02d:%02d", h, m, s)
        } else {
            String.format(Locale.US, "%d:%02d", m, s)
        }
    }

    fun percent(ratio: Double): String = String.format(Locale.US, "%.1f%%", ratio * 100)
}
