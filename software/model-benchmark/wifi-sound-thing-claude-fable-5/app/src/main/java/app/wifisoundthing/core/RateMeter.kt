package app.wifisoundthing.core

import java.util.ArrayDeque

/**
 * Tracks total bytes and a rolling-window bitrate. Time is passed in by the
 * caller so the class stays deterministic and unit-testable.
 */
class RateMeter(private val windowMs: Long = 3000) {
    private class Sample(val timeMs: Long, val bytes: Int)

    private val samples = ArrayDeque<Sample>()
    private var windowBytes = 0L

    @Volatile
    var totalBytes = 0L
        private set

    @Synchronized
    fun record(nowMs: Long, bytes: Int) {
        totalBytes += bytes
        windowBytes += bytes
        samples.addLast(Sample(nowMs, bytes))
        prune(nowMs)
    }

    /** Average bits per second over the rolling window. */
    @Synchronized
    fun bitsPerSecond(nowMs: Long): Long {
        prune(nowMs)
        if (samples.isEmpty()) return 0
        val span = (nowMs - samples.first.timeMs).coerceAtLeast(1)
        return windowBytes * 8 * 1000 / span
    }

    @Synchronized
    fun reset() {
        samples.clear()
        windowBytes = 0
        totalBytes = 0
    }

    private fun prune(nowMs: Long) {
        while (samples.isNotEmpty() && nowMs - samples.first.timeMs > windowMs) {
            windowBytes -= samples.removeFirst().bytes
        }
    }
}
