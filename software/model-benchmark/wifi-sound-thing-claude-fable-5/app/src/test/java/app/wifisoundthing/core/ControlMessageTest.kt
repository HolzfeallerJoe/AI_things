package app.wifisoundthing.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.IOException
import org.junit.Test

class ControlMessageTest {

    private fun roundTrip(message: ControlMessage): ControlMessage =
        ControlMessage.read(DataInputStream(message.encode().inputStream()))

    @Test
    fun `hello round-trips`() {
        val hello = ControlMessage.Hello(Protocol.VERSION, udpPort = 54321, clientName = "Pixel 8 Pro")
        assertEquals(hello, roundTrip(hello))
    }

    @Test
    fun `hello supports the full unsigned port range`() {
        val hello = ControlMessage.Hello(1, udpPort = 65535, clientName = "x")
        assertEquals(65535, (roundTrip(hello) as ControlMessage.Hello).udpPort)
    }

    @Test
    fun `welcome round-trips including codec config bytes`() {
        val config = AudioConfig(48000, 2, Protocol.CODEC_AAC_LC, byteArrayOf(0x11, 0x90.toByte()))
        val welcome = ControlMessage.Welcome(sessionId = -7, config = config)
        assertEquals(welcome, roundTrip(welcome))
    }

    @Test
    fun `ping pong and bye round-trip`() {
        assertEquals(ControlMessage.Ping(Long.MAX_VALUE), roundTrip(ControlMessage.Ping(Long.MAX_VALUE)))
        assertEquals(ControlMessage.Pong(-1L), roundTrip(ControlMessage.Pong(-1L)))
        assertEquals(ControlMessage.Bye, roundTrip(ControlMessage.Bye))
    }

    @Test
    fun `messages can be read back-to-back from one stream`() {
        val buffer = ByteArrayOutputStream()
        buffer.write(ControlMessage.Hello(1, 1000, "a").encode())
        buffer.write(ControlMessage.Ping(42).encode())
        buffer.write(ControlMessage.Bye.encode())
        val stream = DataInputStream(buffer.toByteArray().inputStream())
        assertTrue(ControlMessage.read(stream) is ControlMessage.Hello)
        assertEquals(ControlMessage.Ping(42), ControlMessage.read(stream))
        assertEquals(ControlMessage.Bye, ControlMessage.read(stream))
    }

    @Test(expected = IOException::class)
    fun `unknown message type throws`() {
        ControlMessage.read(DataInputStream(byteArrayOf(99, 0, 0).inputStream()))
    }

    @Test(expected = IOException::class)
    fun `truncated frame throws`() {
        val bytes = ControlMessage.Ping(1).encode()
        ControlMessage.read(DataInputStream(bytes.copyOf(bytes.size - 2).inputStream()))
    }

    @Test(expected = IOException::class)
    fun `oversized frame is rejected`() {
        // type=PING, declared length way beyond MAX_CONTROL_PAYLOAD
        ControlMessage.read(DataInputStream(byteArrayOf(3, 0x7F, 0xFF.toByte()).inputStream()))
    }
}
