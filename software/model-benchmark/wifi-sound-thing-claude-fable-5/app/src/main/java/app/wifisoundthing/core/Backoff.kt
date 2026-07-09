package app.wifisoundthing.core

/**
 * Exponential backoff policy for reconnect attempts:
 * base, 2*base, 4*base, ... capped at [maxMs].
 */
object Backoff {
    const val DEFAULT_BASE_MS = 500L
    const val DEFAULT_MAX_MS = 8000L

    fun delayMs(attempt: Int, baseMs: Long = DEFAULT_BASE_MS, maxMs: Long = DEFAULT_MAX_MS): Long {
        val n = attempt.coerceIn(0, 30)
        val delay = baseMs shl n
        return if (delay <= 0 || delay > maxMs) maxMs else delay
    }
}
