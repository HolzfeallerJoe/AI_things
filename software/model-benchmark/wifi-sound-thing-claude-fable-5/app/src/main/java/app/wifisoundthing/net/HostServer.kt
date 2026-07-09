package app.wifisoundthing.net

import android.util.Log
import app.wifisoundthing.core.AudioConfig
import app.wifisoundthing.core.ControlMessage
import app.wifisoundthing.core.Protocol
import app.wifisoundthing.core.RateMeter
import java.io.DataInputStream
import java.io.DataOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketTimeoutException
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread
import kotlin.random.Random

/**
 * Host side of the network: accepts client control connections over TCP,
 * answers keepalives, and fans encoded audio out to every connected client
 * over UDP.
 */
class HostServer(
    private val controlPort: Int,
    private val audioConfig: AudioConfig,
    private val listener: Listener,
) {
    interface Listener {
        /** Called from network threads whenever a client joins or leaves. */
        fun onClientCountChanged(count: Int)

        /** Called from network threads on a fatal server error. */
        fun onServerError(message: String)
    }

    private class Peer(
        val socket: Socket,
        val udpTarget: InetSocketAddress,
        val output: DataOutputStream,
        @Volatile var lastSeenMs: Long,
    ) {
        val name: String = socket.inetAddress.hostAddress ?: "?"
    }

    private val peers = CopyOnWriteArrayList<Peer>()
    private var serverSocket: ServerSocket? = null
    private var udpSocket: DatagramSocket? = null
    private val sessionId = Random.nextInt()

    val sendMeter = RateMeter()
    val clientCount: Int get() = peers.size

    @Volatile
    var running = false
        private set

    @Throws(Exception::class)
    fun start() {
        udpSocket = DatagramSocket()
        serverSocket = ServerSocket(controlPort)
        running = true
        thread(name = "host-accept") { acceptLoop() }
        thread(name = "host-reaper") { reaperLoop() }
    }

    /** Sends one encoded audio datagram to every connected client. */
    fun broadcast(datagram: ByteArray) {
        val socket = udpSocket ?: return
        if (peers.isEmpty()) return
        val now = System.currentTimeMillis()
        for (peer in peers) {
            try {
                socket.send(DatagramPacket(datagram, datagram.size, peer.udpTarget))
                sendMeter.record(now, datagram.size)
            } catch (e: Exception) {
                Log.w(TAG, "UDP send to ${peer.udpTarget} failed: ${e.message}")
            }
        }
    }

    fun stop() {
        running = false
        for (peer in peers) {
            try {
                peer.output.write(ControlMessage.Bye.encode())
                peer.output.flush()
            } catch (_: Exception) {
            }
            closeQuietly(peer)
        }
        peers.clear()
        try {
            serverSocket?.close()
        } catch (_: Exception) {
        }
        udpSocket?.close()
    }

    private fun acceptLoop() {
        val server = serverSocket ?: return
        while (running) {
            val socket = try {
                server.accept()
            } catch (e: Exception) {
                if (running) {
                    Log.e(TAG, "Accept failed", e)
                    listener.onServerError("Network listener stopped: ${e.message}")
                }
                return
            }
            thread(name = "host-peer-${socket.inetAddress.hostAddress}") { handleClient(socket) }
        }
    }

    private fun handleClient(socket: Socket) {
        val peer: Peer
        try {
            socket.tcpNoDelay = true
            socket.soTimeout = HANDSHAKE_TIMEOUT_MS
            val input = DataInputStream(socket.getInputStream().buffered())
            val output = DataOutputStream(socket.getOutputStream().buffered())

            val hello = ControlMessage.read(input) as? ControlMessage.Hello
                ?: throw IllegalStateException("Expected HELLO")
            if (hello.protocolVersion != Protocol.VERSION) {
                throw IllegalStateException("Client protocol version ${hello.protocolVersion} != ${Protocol.VERSION}")
            }
            output.write(ControlMessage.Welcome(sessionId, audioConfig).encode())
            output.flush()

            peer = Peer(
                socket = socket,
                udpTarget = InetSocketAddress(socket.inetAddress, hello.udpPort),
                output = output,
                lastSeenMs = System.currentTimeMillis(),
            )
            peers.add(peer)
            listener.onClientCountChanged(peers.size)
            Log.i(TAG, "Client joined: ${peer.name} (udp ${hello.udpPort}), ${peers.size} total")

            socket.soTimeout = Protocol.PEER_TIMEOUT_MS.toInt()
            while (running && !socket.isClosed) {
                when (val message = ControlMessage.read(input)) {
                    is ControlMessage.Ping -> {
                        peer.lastSeenMs = System.currentTimeMillis()
                        synchronized(peer.output) {
                            peer.output.write(ControlMessage.Pong(message.timeMs).encode())
                            peer.output.flush()
                        }
                    }
                    is ControlMessage.Bye -> break
                    else -> Log.w(TAG, "Unexpected message from ${peer.name}: $message")
                }
            }
        } catch (e: SocketTimeoutException) {
            Log.i(TAG, "Client timed out: ${socket.inetAddress.hostAddress}")
        } catch (e: Exception) {
            if (running) Log.i(TAG, "Client connection ended: ${e.message}")
        } finally {
            removePeer(socket)
        }
    }

    private fun reaperLoop() {
        while (running) {
            try {
                Thread.sleep(REAPER_INTERVAL_MS)
            } catch (e: InterruptedException) {
                return
            }
            val cutoff = System.currentTimeMillis() - Protocol.PEER_TIMEOUT_MS
            for (peer in peers) {
                if (peer.lastSeenMs < cutoff) {
                    Log.i(TAG, "Reaping silent client ${peer.name}")
                    closeQuietly(peer) // triggers removal in handleClient's finally block
                }
            }
        }
    }

    private fun removePeer(socket: Socket) {
        val removed = peers.removeAll { it.socket === socket }
        try {
            socket.close()
        } catch (_: Exception) {
        }
        if (removed) listener.onClientCountChanged(peers.size)
    }

    private fun closeQuietly(peer: Peer) {
        try {
            peer.socket.close()
        } catch (_: Exception) {
        }
    }

    companion object {
        private const val TAG = "HostServer"
        private const val HANDSHAKE_TIMEOUT_MS = 5000
        private const val REAPER_INTERVAL_MS = 2000L
    }
}
