package com.portblocker.app.network

import java.net.ServerSocket
import java.net.SocketException

class TcpBlockerManager(
    private val state: BlockerState,
    private val onStatusChanged: (BlockerState) -> Unit
) : BlockerManager {

    override
    fun start() {
        state.status = BlockerStatus.LISTENING
        state.paused = false
        state.errorMessage = null
        val socket = ServerSocket(state.port)
        socket.reuseAddress = true
        state.serverSocket = socket

        state.thread = Thread {
            try {
                while (!Thread.currentThread().isInterrupted && state.status != BlockerStatus.STOPPED) {
                    socket.soTimeout = 1000
                    try {
                        val client = socket.accept()
                        state.connectionsCount++
                        state.lastActivity = System.currentTimeMillis()
                        onStatusChanged(state)

                        val clientThread = Thread {
                            try {
                                val input = client.getInputStream()
                                val buffer = ByteArray(4096)
                                while (!Thread.currentThread().isInterrupted && state.status != BlockerStatus.STOPPED) {
                                    if (state.paused) {
                                        Thread.sleep(200)
                                        continue
                                    }
                                    val read = input.read(buffer)
                                    if (read == -1) break
                                    state.bytesReceived += read
                                    state.lastActivity = System.currentTimeMillis()
                                    onStatusChanged(state)
                                }
                            } catch (_: SocketException) {
                                // Client disconnected
                            } catch (_: InterruptedException) {
                                // Thread interrupted
                            } finally {
                                try { client.close() } catch (_: Exception) {}
                            }
                        }
                        clientThread.isDaemon = true
                        state.clientThreads.add(clientThread)
                        clientThread.start()
                    } catch (_: java.net.SocketTimeoutException) {
                        // Accept timed out, loop back to check flags
                    }
                }
            } catch (_: SocketException) {
                if (state.status != BlockerStatus.STOPPED && state.status != BlockerStatus.PAUSED) {
                    state.status = BlockerStatus.ERROR
                    state.errorMessage = "Socket closed unexpectedly"
                    onStatusChanged(state)
                }
            } catch (e: Exception) {
                if (state.status != BlockerStatus.STOPPED && state.status != BlockerStatus.PAUSED) {
                    state.status = BlockerStatus.ERROR
                    state.errorMessage = e.message ?: "Unknown error"
                    onStatusChanged(state)
                }
            }
        }
        state.thread?.isDaemon = true
        state.thread?.start()
    }

    override
    fun pause() {
        state.status = BlockerStatus.PAUSED
        state.paused = true
        closeSockets()
    }

    override
    fun resume() {
        if (state.status == BlockerStatus.LISTENING) {
            return
        }
        start()
    }

    override
    fun stop() {
        state.status = BlockerStatus.STOPPED
        state.paused = false
        closeSockets()
    }

    private fun closeSockets() {
        state.clientThreads.forEach { it.interrupt() }
        state.clientThreads.clear()
        state.thread?.interrupt()
        try { state.serverSocket?.close() } catch (_: Exception) {}
        state.serverSocket = null
        state.thread = null
    }
}
