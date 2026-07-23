package com.fable.wifisoundthing.protocol

/**
 * Reorder/jitter buffer for the UDP audio stream.
 *
 * The receiver thread calls [push] for every packet; the playback thread calls [pop] in a
 * loop. Sequence numbers are compared with wraparound-safe signed arithmetic (`a - b`),
 * so the buffer keeps working when the 32-bit counter wraps.
 *
 * Behavior:
 *  - Playback starts once [prebufferPackets] consecutive-ish packets are queued.
 *  - A packet that fails to arrive while up to [reorderWindow] newer packets are already
 *    queued is declared lost ([PopResult.Missing]) and playback moves on (caller inserts
 *    silence for its duration).
 *  - If the queue grows beyond [maxDepthPackets] (e.g. after a network stall the sender
 *    kept transmitting), old packets are dropped so latency snaps back to the target.
 *  - A sequence jump larger than [RESET_THRESHOLD] (host restarted) resets the buffer.
 *  - On a complete underrun the buffer re-enters the prebuffering state.
 */
class JitterBuffer(
    private val prebufferPackets: Int = 3,
    private val maxDepthPackets: Int = 25,
    private val reorderWindow: Int = 2,
) {
    sealed class PopResult {
        /** A packet is ready for playback. */
        data class Packet(val seq: Int, val payload: ByteArray) : PopResult()

        /** The next packet was lost; play concealment (silence) for one packet duration. */
        object Missing : PopResult()

        /** Nothing to play yet (buffering or waiting for a possibly-reordered packet). */
        object Waiting : PopResult()
    }

    data class Stats(
        val received: Long,
        val lost: Long,
        val late: Long,
        val overflowDropped: Long,
        val resets: Long,
        val depthPackets: Int,
    )

    private val packets = HashMap<Int, ByteArray>()
    private var primed = false
    private var started = false
    private var nextSeq = 0
    private var highestSeq = 0

    private var received = 0L
    private var lost = 0L
    private var late = 0L
    private var overflowDropped = 0L
    private var resets = 0L

    @Synchronized
    fun push(seq: Int, payload: ByteArray) {
        if (!primed) {
            primed = true
            nextSeq = seq
            highestSeq = seq
            packets[seq] = payload
            received++
            return
        }
        val fromNext = seq - nextSeq
        if (fromNext > RESET_THRESHOLD || fromNext < -RESET_THRESHOLD) {
            // Host restarted or clock jumped; start over from this packet.
            packets.clear()
            started = false
            nextSeq = seq
            highestSeq = seq
            packets[seq] = payload
            resets++
            received++
            return
        }
        if (fromNext < 0) {
            late++
            return
        }
        if (packets.put(seq, payload) == null) received++
        if (seq - highestSeq > 0) highestSeq = seq
    }

    @Synchronized
    fun pop(): PopResult {
        if (!primed) return PopResult.Waiting

        if (packets.isEmpty()) {
            // Complete underrun: rebuild the safety cushion before resuming.
            started = false
            return PopResult.Waiting
        }

        if (!started) {
            if (highestSeq - nextSeq + 1 >= prebufferPackets) {
                started = true
            } else {
                return PopResult.Waiting
            }
        }

        // Latency guard: if far too much is queued, jump forward to the freshest audio.
        if (highestSeq - nextSeq + 1 > maxDepthPackets) {
            val target = highestSeq - (prebufferPackets - 1)
            while (nextSeq - target < 0) {
                if (packets.remove(nextSeq) != null) overflowDropped++
                nextSeq++
            }
        }

        val payload = packets.remove(nextSeq)
        if (payload != null) {
            val seq = nextSeq
            nextSeq++
            return PopResult.Packet(seq, payload)
        }
        return if (highestSeq - nextSeq >= reorderWindow) {
            lost++
            nextSeq++
            PopResult.Missing
        } else {
            PopResult.Waiting
        }
    }

    @Synchronized
    fun stats(): Stats = Stats(
        received = received,
        lost = lost,
        late = late,
        overflowDropped = overflowDropped,
        resets = resets,
        depthPackets = if (packets.isEmpty()) 0 else highestSeq - nextSeq + 1,
    )

    @Synchronized
    fun clear() {
        packets.clear()
        primed = false
        started = false
    }

    companion object {
        const val RESET_THRESHOLD = 1000
    }
}
