package com.wifisoundthing.claudeopus46.audio

import android.util.Log
import java.util.TreeMap
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * Thread-safe reordering jitter buffer for the client side.
 *
 * Incoming audio frames are inserted by sequence number. The buffer waits until
 * [depth] frames are buffered ("primed") before the first read, then delivers
 * frames in strict sequence order. Gaps are filled with silence.
 */
class JitterBuffer(
    private val depth: Int,
    private val frameSizeBytes: Int
) {
    companion object {
        private const val TAG = "JitterBuffer"
    }

    private val lock = ReentrantLock()
    private val dataAvailable = lock.newCondition()
    private val buffer = TreeMap<Int, ByteArray>()

    private var nextExpectedSeq = -1
    private var primed = false

    @Volatile
    var stopped = false
        private set

    // Statistics
    var packetsReceived = 0L
        private set
    var packetsDropped = 0L
        private set
    var outOfOrderCount = 0L
        private set

    /**
     * Insert a decoded PCM frame into the buffer.
     * Called from the receiver thread.
     */
    fun put(sequenceNumber: Int, pcmData: ByteArray) {
        lock.withLock {
            packetsReceived++

            // First frame ever — seed the expected sequence
            if (nextExpectedSeq < 0) {
                nextExpectedSeq = sequenceNumber
            }

            // Discard frames older than what we've already played
            if (sequenceNumber < nextExpectedSeq) {
                packetsDropped++
                return
            }

            // Track out-of-order arrivals
            if (buffer.isNotEmpty() && sequenceNumber < buffer.lastKey()) {
                outOfOrderCount++
            }

            buffer[sequenceNumber] = pcmData

            // Limit buffer size to prevent unbounded growth (4× depth is generous)
            while (buffer.size > depth * 4) {
                val removed = buffer.pollFirstEntry()
                if (removed != null) {
                    packetsDropped++
                    // Advance expected seq past dropped frames
                    if (removed.key >= nextExpectedSeq) {
                        nextExpectedSeq = removed.key + 1
                    }
                }
            }

            // Signal the playback thread if we have enough data
            if (!primed && buffer.size >= depth) {
                primed = true
                Log.d(TAG, "Buffer primed with $depth frames")
            }

            if (primed) {
                dataAvailable.signal()
            }
        }
    }

    /**
     * Blocking read — returns the next frame in sequence order.
     * Called from the playback thread.
     *
     * Returns silence (zero bytes) for gaps in the sequence.
     */
    fun take(): ByteArray {
        lock.withLock {
            // Wait until primed and we have data (or stopped)
            while (!stopped && (!primed || buffer.isEmpty())) {
                dataAvailable.await()
            }

            if (stopped) {
                return ByteArray(frameSizeBytes)
            }

            val frame = buffer.remove(nextExpectedSeq)
            nextExpectedSeq++

            if (frame != null) {
                return frame
            }

            // Gap — fill with silence and advance
            packetsDropped++
            return ByteArray(frameSizeBytes)
        }
    }

    /** Reset all state. Safe to call from any thread. */
    fun reset() {
        lock.withLock {
            buffer.clear()
            nextExpectedSeq = -1
            primed = false
            stopped = false
            packetsReceived = 0
            packetsDropped = 0
            outOfOrderCount = 0
            dataAvailable.signalAll()
        }
    }

    /** Signal the playback thread to unblock and exit. */
    fun stop() {
        lock.withLock {
            stopped = true
            dataAvailable.signalAll()
        }
    }

    /** Current number of buffered frames. */
    fun currentDepth(): Int {
        lock.withLock {
            return buffer.size
        }
    }
}
