package app.wifisoundthing.core

import java.util.TreeMap

/**
 * Reorders incoming audio packets and absorbs network delay variation.
 *
 * The playback thread calls [poll] once per frame it wants to play; the network
 * thread calls [put] whenever a datagram arrives. Playback starts only after
 * [targetDepth] packets have accumulated, which gives late/reordered packets
 * `targetDepth * frameDuration` to arrive before their slot is played.
 *
 * If the buffer grows past [maxDepth] (host kept sending while we stalled),
 * old frames are skipped so latency stays bounded instead of drifting upward.
 */
class JitterBuffer(
    val targetDepth: Int = DEFAULT_TARGET_DEPTH,
    private val maxDepth: Int = targetDepth * 3 + 2,
) {
    sealed class Event {
        /** Play this frame. */
        class Frame(val payload: ByteArray, val ptsUs: Long) : Event()

        /** Packet was lost — conceal (e.g. play one frame of silence). */
        object Gap : Event()

        /** Not enough buffered data — wait roughly one frame duration and poll again. */
        object Buffering : Event()
    }

    private val packets = TreeMap<Long, AudioPacket>()
    private var nextSeq = NO_SEQ
    private var playing = false

    // Statistics (reads are approximate; written under lock)
    @Volatile var received = 0L; private set
    @Volatile var duplicates = 0L; private set
    @Volatile var late = 0L; private set
    @Volatile var gaps = 0L; private set
    @Volatile var underruns = 0L; private set
    @Volatile var latencySkips = 0L; private set

    val depth: Int get() = synchronized(this) { packets.size }
    val isPlaying: Boolean get() = synchronized(this) { playing }

    /** Fraction of expected packets that never made it to playback, over the whole session. */
    val lossRatio: Double
        get() {
            val expected = received + gaps
            return if (expected == 0L) 0.0 else gaps.toDouble() / expected
        }

    @Synchronized
    fun put(packet: AudioPacket) {
        received++
        if (nextSeq != NO_SEQ && packet.seq < nextSeq) {
            late++
            return
        }
        if (packets.containsKey(packet.seq)) {
            duplicates++
            return
        }
        packets[packet.seq] = packet
        if (packets.size > maxDepth) {
            while (packets.size > targetDepth) {
                packets.pollFirstEntry()
                latencySkips++
            }
            nextSeq = packets.firstKey()
        }
    }

    @Synchronized
    fun poll(): Event {
        if (!playing) {
            if (packets.size < targetDepth) return Event.Buffering
            playing = true
            nextSeq = packets.firstKey()
        }
        if (packets.isEmpty()) {
            playing = false
            underruns++
            return Event.Buffering
        }
        val packet = packets.remove(nextSeq)
        nextSeq++
        return if (packet != null) {
            Event.Frame(packet.payload, packet.ptsUs)
        } else {
            gaps++
            Event.Gap
        }
    }

    @Synchronized
    fun reset() {
        packets.clear()
        nextSeq = NO_SEQ
        playing = false
    }

    companion object {
        const val DEFAULT_TARGET_DEPTH = 5
        private const val NO_SEQ = -1L
    }
}
