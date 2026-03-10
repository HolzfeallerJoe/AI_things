package com.portblocker.app.network

import java.net.DatagramSocket
import java.net.ServerSocket

enum class BlockerStatus {
    LISTENING, PAUSED, STOPPED, ERROR
}

data class BlockerState(
    val id: String,
    val port: Int,
    val protocol: String,
    @Volatile var status: BlockerStatus = BlockerStatus.LISTENING,
    @Volatile var paused: Boolean = false,
    @Volatile var connectionsCount: Int = 0,
    @Volatile var bytesReceived: Long = 0,
    @Volatile var lastActivity: Long? = null,
    @Volatile var errorMessage: String? = null,
    var serverSocket: ServerSocket? = null,
    var datagramSocket: DatagramSocket? = null,
    var thread: Thread? = null,
    val clientThreads: MutableList<Thread> = mutableListOf()
)
