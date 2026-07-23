package com.fable.wifisoundthing.net

import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetSocketAddress
import java.util.concurrent.atomic.AtomicLong

/** Unicasts audio packets to every connected client over UDP. */
class AudioSender {
    private val socket = DatagramSocket()
    val bytesSent = AtomicLong(0)
    val packetsSent = AtomicLong(0)

    fun send(data: ByteArray, targets: List<InetSocketAddress>) {
        for (target in targets) {
            try {
                socket.send(DatagramPacket(data, data.size, target))
                bytesSent.addAndGet(data.size.toLong())
                packetsSent.incrementAndGet()
            } catch (_: Exception) {
                // Transient send failures (e.g. Wi-Fi blip) are tolerated; the control
                // channel decides when a client is really gone.
            }
        }
    }

    fun close() {
        try {
            socket.close()
        } catch (_: Exception) {
        }
    }
}
