package app.wifisoundthing.net

import android.util.Log
import app.wifisoundthing.audio.PlaybackEngine
import app.wifisoundthing.core.AudioPacketCodec
import app.wifisoundthing.core.Backoff
import app.wifisoundthing.core.ControlMessage
import app.wifisoundthing.core.JitterBuffer
import app.wifisoundthing.core.Protocol
import app.wifisoundthing.core.RateMeter
import java.io.DataInputStream
import java.io.DataOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetSocketAddress
import java.net.Socket
import java.util.concurrent.CountDownLatch
import kotlin.concurrent.thread

/**
 * Client side of the network. Owns the whole receive pipeline:
 * TCP handshake -> UDP receive -> jitter buffer -> decoder -> AudioTrack.
 *
 * A supervisor thread keeps the session alive: when the connection drops for
 * any reason it reconnects automatically with exponential backoff until
 * [stop] is called (NFR-4).
 */
class ClientEngine(
    private val hostAddress: String,
    private val controlPort: Int,
    private val clientName: String,
    private val jitterDepth: Int,
    private val listener: Listener,
) {
    enum class State { CONNECTING, BUFFERING, PLAYING, RECONNECTING, STOPPED, FAILED }

    class Stats(
        val bitsPerSecond: Long,
        val totalBytes: Long,
        val bufferDepth: Int,
        val bufferTarget: Int,
        val lossRatio: Double,
        val underruns: Long,
    )

    interface Listener {
        /** Called from network threads. [detail] is a plain-language explanation for the user. */
        fun onStateChanged(state: State, detail: String?)

        fun onStatsUpdated(stats: Stats)
    }

    @Volatile
    private var running = false
    private var supervisorThread: Thread? = null

    @Volatile
    private var currentSession: Session? = null

    private val receiveMeter = RateMeter()

    fun start() {
        if (running) return
        running = true
        supervisorThread = thread(name = "client-supervisor") { supervise() }
    }

    fun stop() {
        running = false
        currentSession?.close(sendBye = true)
        supervisorThread?.interrupt()
        supervisorThread?.join(3000)
        supervisorThread = null
        listener.onStateChanged(State.STOPPED, null)
    }

    private fun supervise() {
        var attempt = 0
        while (running) {
            listener.onStateChanged(
                if (attempt == 0) State.CONNECTING else State.RECONNECTING,
                if (attempt == 0) null else "Connection lost — trying to reconnect…",
            )
            val session = Session()
            currentSession = session
            val startedAt = System.currentTimeMillis()
            val failure = try {
                session.run() // returns when the session dies; null = clean stop
            } catch (e: InterruptedException) {
                null
            } catch (e: Exception) {
                e.message ?: e.javaClass.simpleName
            } finally {
                session.close(sendBye = false)
                currentSession = null
            }
            if (!running) return
            // A session that lasted a while was a working connection: restart backoff.
            if (System.currentTimeMillis() - startedAt > STABLE_SESSION_MS) attempt = 0
            attempt++
            if (failure != null) Log.i(TAG, "Session ended: $failure")
            if (attempt >= MAX_ATTEMPTS_BEFORE_FAIL) {
                listener.onStateChanged(
                    State.FAILED,
                    "Could not reach the host at $hostAddress. Check that the host is broadcasting and both phones are on the same Wi-Fi.",
                )
                // Keep trying in the background, but at the slowest pace.
            }
            try {
                Thread.sleep(Backoff.delayMs(attempt - 1))
            } catch (e: InterruptedException) {
                return
            }
        }
    }

    /** One connection lifetime. All sockets/threads are torn down when it ends. */
    private inner class Session {
        private val done = CountDownLatch(1)

        @Volatile
        private var failureReason: String? = null

        @Volatile
        private var closed = false
        private var tcpSocket: Socket? = null
        private var udpSocket: DatagramSocket? = null
        private var output: DataOutputStream? = null
        private var playback: PlaybackEngine? = null
        private val threads = mutableListOf<Thread>()

        @Volatile
        private var lastPongMs = System.currentTimeMillis()

        /** Blocks until the session dies; returns the failure reason or null on clean stop. */
        fun run(): String? {
            val udp = DatagramSocket()
            udpSocket = udp
            val socket = Socket()
            tcpSocket = socket
            socket.tcpNoDelay = true
            socket.connect(InetSocketAddress(hostAddress, controlPort), CONNECT_TIMEOUT_MS)
            socket.soTimeout = HANDSHAKE_TIMEOUT_MS

            val input = DataInputStream(socket.getInputStream().buffered())
            val out = DataOutputStream(socket.getOutputStream().buffered())
            output = out
            out.write(ControlMessage.Hello(Protocol.VERSION, udp.localPort, clientName).encode())
            out.flush()
            val welcome = ControlMessage.read(input) as? ControlMessage.Welcome
                ?: throw IllegalStateException("Host did not answer the handshake correctly")
            Log.i(TAG, "Connected to $hostAddress: ${welcome.config}")

            val jitterBuffer = JitterBuffer(jitterDepth)
            val player = PlaybackEngine(
                config = welcome.config,
                jitterBuffer = jitterBuffer,
                onStateChanged = { buffering ->
                    if (running && !closed) {
                        listener.onStateChanged(if (buffering) State.BUFFERING else State.PLAYING, null)
                    }
                },
                onError = { message -> fail(message) },
            )
            playback = player
            player.start()

            lastPongMs = System.currentTimeMillis()
            socket.soTimeout = 0

            threads += thread(name = "client-udp-rx") { udpReceiveLoop(udp, jitterBuffer) }
            threads += thread(name = "client-control-rx") { controlReadLoop(input) }
            threads += thread(name = "client-ping") { pingLoop(out, jitterBuffer) }

            done.await()
            return failureReason
        }

        private fun udpReceiveLoop(udp: DatagramSocket, jitterBuffer: JitterBuffer) {
            val buffer = ByteArray(AudioPacketCodec.HEADER_SIZE + Protocol.MAX_AUDIO_PAYLOAD)
            val datagram = DatagramPacket(buffer, buffer.size)
            while (!closed) {
                try {
                    udp.receive(datagram)
                } catch (e: Exception) {
                    if (!closed) fail("Audio stream interrupted: ${e.message}")
                    return
                }
                val packet = AudioPacketCodec.decode(datagram.data, datagram.length) ?: continue
                receiveMeter.record(System.currentTimeMillis(), datagram.length)
                jitterBuffer.put(packet)
            }
        }

        private fun controlReadLoop(input: DataInputStream) {
            while (!closed) {
                val message = try {
                    ControlMessage.read(input)
                } catch (e: Exception) {
                    if (!closed) fail("Lost connection to the host")
                    return
                }
                when (message) {
                    is ControlMessage.Pong -> lastPongMs = System.currentTimeMillis()
                    is ControlMessage.Bye -> {
                        fail("The host stopped broadcasting")
                        return
                    }
                    else -> Log.w(TAG, "Unexpected control message: $message")
                }
            }
        }

        private fun pingLoop(out: DataOutputStream, jitterBuffer: JitterBuffer) {
            while (!closed) {
                try {
                    synchronized(out) {
                        out.write(ControlMessage.Ping(System.currentTimeMillis()).encode())
                        out.flush()
                    }
                } catch (e: Exception) {
                    if (!closed) fail("Lost connection to the host")
                    return
                }
                if (System.currentTimeMillis() - lastPongMs > Protocol.PEER_TIMEOUT_MS) {
                    fail("The host is not responding")
                    return
                }
                listener.onStatsUpdated(
                    Stats(
                        bitsPerSecond = receiveMeter.bitsPerSecond(System.currentTimeMillis()),
                        totalBytes = receiveMeter.totalBytes,
                        bufferDepth = jitterBuffer.depth,
                        bufferTarget = jitterBuffer.targetDepth,
                        lossRatio = jitterBuffer.lossRatio,
                        underruns = jitterBuffer.underruns,
                    ),
                )
                try {
                    Thread.sleep(Protocol.PING_INTERVAL_MS)
                } catch (e: InterruptedException) {
                    return
                }
            }
        }

        private fun fail(reason: String) {
            if (closed) return
            failureReason = reason
            close(sendBye = false)
        }

        fun close(sendBye: Boolean) {
            if (closed) return
            closed = true
            if (sendBye) {
                try {
                    output?.let {
                        synchronized(it) {
                            it.write(ControlMessage.Bye.encode())
                            it.flush()
                        }
                    }
                } catch (_: Exception) {
                }
            }
            playback?.stop()
            try {
                tcpSocket?.close()
            } catch (_: Exception) {
            }
            udpSocket?.close()
            done.countDown()
        }
    }

    companion object {
        private const val TAG = "ClientEngine"
        private const val CONNECT_TIMEOUT_MS = 4000
        private const val HANDSHAKE_TIMEOUT_MS = 5000
        private const val MAX_ATTEMPTS_BEFORE_FAIL = 5
        private const val STABLE_SESSION_MS = 10_000L
    }
}
