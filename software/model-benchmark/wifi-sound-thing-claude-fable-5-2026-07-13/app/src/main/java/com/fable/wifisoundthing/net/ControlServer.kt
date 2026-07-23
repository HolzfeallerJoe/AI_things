package com.fable.wifisoundthing.net

import android.util.Log
import com.fable.wifisoundthing.protocol.ControlMessage
import java.io.BufferedReader
import java.io.BufferedWriter
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicLong
import kotlin.concurrent.thread

/**
 * The host's TCP control channel. Accepts clients, performs the hello/config handshake,
 * answers pings, and tracks which UDP endpoints should receive audio. One thread per
 * client — fine for a handful of listeners on a LAN.
 */
class ControlServer(
    private val port: Int,
    private val configProvider: () -> ControlMessage.Config,
    private val listener: Listener,
) {
    interface Listener {
        fun onClientsChanged(clients: List<ClientEndpoint>)
    }

    class ClientEndpoint(
        val id: Long,
        val name: String,
        val udpAddress: InetSocketAddress,
        internal val socket: Socket,
        internal val writer: BufferedWriter,
    ) {
        internal val writeLock = Any()
    }

    private val serverSocket = ServerSocket()
    private val clients = CopyOnWriteArrayList<ClientEndpoint>()
    private val nextId = AtomicLong(1)

    @Volatile
    private var running = false

    /** Binds and starts accepting. Throws if the port is unavailable. */
    fun start() {
        serverSocket.reuseAddress = true
        serverSocket.bind(InetSocketAddress(port))
        running = true
        thread(name = "control-accept", isDaemon = true) {
            while (running) {
                val socket = try {
                    serverSocket.accept()
                } catch (_: Exception) {
                    break
                }
                thread(name = "control-client", isDaemon = true) { handleClient(socket) }
            }
        }
    }

    fun clientEndpoints(): List<ClientEndpoint> = clients.toList()

    private fun handleClient(socket: Socket) {
        var endpoint: ClientEndpoint? = null
        try {
            socket.tcpNoDelay = true
            socket.soTimeout = HANDSHAKE_TIMEOUT_MS
            val reader = BufferedReader(InputStreamReader(socket.getInputStream(), Charsets.UTF_8))
            val writer = BufferedWriter(OutputStreamWriter(socket.getOutputStream(), Charsets.UTF_8))

            val hello = ControlMessage.parse(reader.readLine() ?: return) as? ControlMessage.Hello
                ?: return
            endpoint = ClientEndpoint(
                id = nextId.getAndIncrement(),
                name = hello.name,
                udpAddress = InetSocketAddress(socket.inetAddress, hello.udpPort),
                socket = socket,
                writer = writer,
            )
            send(endpoint, configProvider())

            clients.add(endpoint)
            listener.onClientsChanged(clients.toList())

            socket.soTimeout = CLIENT_IDLE_TIMEOUT_MS
            while (running) {
                val line = reader.readLine() ?: break
                when (ControlMessage.parse(line)) {
                    is ControlMessage.Ping -> send(endpoint, ControlMessage.Pong)
                    is ControlMessage.Bye -> break
                    else -> {} // ignore anything unknown
                }
            }
        } catch (e: Exception) {
            Log.d(TAG, "client connection ended: ${e.message}")
        } finally {
            if (endpoint != null && clients.remove(endpoint)) {
                listener.onClientsChanged(clients.toList())
            }
            try {
                socket.close()
            } catch (_: Exception) {
            }
        }
    }

    private fun send(endpoint: ClientEndpoint, message: ControlMessage) {
        synchronized(endpoint.writeLock) {
            endpoint.writer.write(message.toJson())
            endpoint.writer.write("\n")
            endpoint.writer.flush()
        }
    }

    fun stop() {
        running = false
        for (endpoint in clients) {
            try {
                send(endpoint, ControlMessage.Bye("Host stopped the broadcast"))
            } catch (_: Exception) {
            }
            try {
                endpoint.socket.close()
            } catch (_: Exception) {
            }
        }
        clients.clear()
        try {
            serverSocket.close()
        } catch (_: Exception) {
        }
    }

    companion object {
        private const val TAG = "ControlServer"
        private const val HANDSHAKE_TIMEOUT_MS = 5_000
        private const val CLIENT_IDLE_TIMEOUT_MS = 20_000
    }
}
