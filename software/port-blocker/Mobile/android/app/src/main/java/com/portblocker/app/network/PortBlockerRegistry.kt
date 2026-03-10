package com.portblocker.app.network

import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArraySet

object PortBlockerRegistry {
    private val blockers = ConcurrentHashMap<String, BlockerState>()
    private val managers = ConcurrentHashMap<String, BlockerManager>()
    private val statusListeners = CopyOnWriteArraySet<(BlockerState) -> Unit>()

    @Synchronized
    fun startBlocker(port: Int, protocol: String): BlockerState {
        val id = UUID.randomUUID().toString()
        val state = BlockerState(id = id, port = port, protocol = protocol)
        blockers[id] = state

        try {
            val manager: BlockerManager = when (protocol) {
                "tcp" -> TcpBlockerManager(state, ::emitStatusChange)
                "udp" -> UdpBlockerManager(state, ::emitStatusChange)
                else -> throw IllegalArgumentException("Unsupported protocol: $protocol")
            }

            managers[id] = manager
            manager.start()
            emitStatusChange(state)
            return state
        } catch (e: Exception) {
            blockers.remove(id)
            managers.remove(id)
            throw e
        }
    }

    @Synchronized
    fun pauseBlocker(id: String): BlockerState {
        val state = blockers[id] ?: throw IllegalArgumentException("Blocker not found")
        val manager = managers[id] ?: throw IllegalStateException("Blocker manager not found")
        manager.pause()
        emitStatusChange(state)
        return state
    }

    @Synchronized
    fun resumeBlocker(id: String): BlockerState {
        val state = blockers[id] ?: throw IllegalArgumentException("Blocker not found")
        val manager = managers[id] ?: throw IllegalStateException("Blocker manager not found")
        return try {
            manager.resume()
            emitStatusChange(state)
            state
        } catch (e: Exception) {
            state.status = BlockerStatus.ERROR
            state.errorMessage = e.message ?: "Failed to resume blocker"
            emitStatusChange(state)
            throw e
        }
    }

    @Synchronized
    fun stopBlocker(id: String) {
        val state = blockers[id] ?: throw IllegalArgumentException("Blocker not found")
        val manager = managers[id] ?: throw IllegalStateException("Blocker manager not found")
        state.status = BlockerStatus.STOPPED
        state.paused = false
        state.errorMessage = null
        manager.stop()
        emitStatusChange(state)
        managers.remove(id)
        blockers.remove(id)
    }

    @Synchronized
    fun pauseAll() {
        blockers.keys.toList().forEach { id ->
            val state = blockers[id] ?: return@forEach
            if (state.status == BlockerStatus.LISTENING) {
                managers[id]?.pause()
                emitStatusChange(state)
            }
        }
    }

    @Synchronized
    fun resumeAll() {
        blockers.keys.toList().forEach { id ->
            val state = blockers[id] ?: return@forEach
            if (state.status == BlockerStatus.PAUSED || state.status == BlockerStatus.ERROR) {
                try {
                    managers[id]?.resume()
                    emitStatusChange(state)
                } catch (e: Exception) {
                    state.status = BlockerStatus.ERROR
                    state.errorMessage = e.message ?: "Failed to resume blocker"
                    emitStatusChange(state)
                }
            }
        }
    }

    @Synchronized
    fun stopAll() {
        blockers.keys.toList().forEach { id ->
            try {
                stopBlocker(id)
            } catch (_: Exception) {
                // Best effort stop for notification action.
            }
        }
    }

    fun getBlockers(): List<BlockerState> {
        return blockers.values
            .sortedWith(compareBy<BlockerState> { it.port }.thenBy { it.protocol })
            .toList()
    }

    fun hasBlockers(): Boolean {
        return blockers.isNotEmpty()
    }

    fun addStatusListener(listener: (BlockerState) -> Unit) {
        statusListeners.add(listener)
    }

    fun removeStatusListener(listener: (BlockerState) -> Unit) {
        statusListeners.remove(listener)
    }

    private fun emitStatusChange(state: BlockerState) {
        statusListeners.forEach { listener ->
            listener(state)
        }
    }
}
