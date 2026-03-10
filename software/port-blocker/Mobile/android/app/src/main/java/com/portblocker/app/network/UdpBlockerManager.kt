package com.portblocker.app.network

import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetSocketAddress
import java.net.SocketException

class UdpBlockerManager(
    private val state: BlockerState,
    private val onStatusChanged: (BlockerState) -> Unit
) : BlockerManager {

    override
    fun start() {
        state.status = BlockerStatus.LISTENING
        state.paused = false
        state.errorMessage = null
        val socket = DatagramSocket(null).apply {
            reuseAddress = false
            bind(InetSocketAddress(state.port))
        }
        state.datagramSocket = socket

        state.thread = Thread {
            try {
                val buffer = ByteArray(65535)
                while (!Thread.currentThread().isInterrupted && state.status != BlockerStatus.STOPPED) {
                    socket.soTimeout = 1000
                    try {
                        val packet = DatagramPacket(buffer, buffer.size)
                        socket.receive(packet)
                        state.connectionsCount++
                        state.bytesReceived += packet.length
                        state.lastActivity = System.currentTimeMillis()
                        onStatusChanged(state)
                    } catch (_: java.net.SocketTimeoutException) {
                        // Receive timed out, loop back to check flags
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
        closeSocket()
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
        closeSocket()
    }

    private fun closeSocket() {
        state.thread?.interrupt()
        try { state.datagramSocket?.close() } catch (_: Exception) {}
        state.datagramSocket = null
        state.thread = null
    }
}
