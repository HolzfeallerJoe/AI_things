package com.fable.wifisoundthing.protocol

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ControlMessageTest {

    @Test
    fun `hello roundtrip`() {
        val hello = ControlMessage.Hello(name = "Pixel 7", udpPort = 54321)
        val parsed = ControlMessage.parse(hello.toJson()) as ControlMessage.Hello
        assertEquals("Pixel 7", parsed.name)
        assertEquals(54321, parsed.udpPort)
        assertEquals(Wire.PROTOCOL_VERSION, parsed.version)
    }

    @Test
    fun `config roundtrip with opus head`() {
        val head = OpusCsd.defaultOpusHead(2, 48_000)
        val config = ControlMessage.Config(
            codec = "opus",
            sampleRate = 48_000,
            channels = 2,
            frameMs = 20,
            hostName = "Living room phone",
            opusHead = head,
        )
        val parsed = ControlMessage.parse(config.toJson()) as ControlMessage.Config
        assertEquals("opus", parsed.codec)
        assertEquals(48_000, parsed.sampleRate)
        assertEquals(2, parsed.channels)
        assertEquals(20, parsed.frameMs)
        assertEquals("Living room phone", parsed.hostName)
        assertArrayEquals(head, parsed.opusHead)
    }

    @Test
    fun `config roundtrip without opus head`() {
        val config = ControlMessage.Config(
            codec = "pcm16",
            sampleRate = 48_000,
            channels = 2,
            frameMs = 20,
            hostName = "Host",
        )
        val parsed = ControlMessage.parse(config.toJson()) as ControlMessage.Config
        assertEquals("pcm16", parsed.codec)
        assertNull(parsed.opusHead)
    }

    @Test
    fun `ping pong bye roundtrip`() {
        assertTrue(ControlMessage.parse(ControlMessage.Ping.toJson()) is ControlMessage.Ping)
        assertTrue(ControlMessage.parse(ControlMessage.Pong.toJson()) is ControlMessage.Pong)
        val bye = ControlMessage.parse(ControlMessage.Bye("done").toJson()) as ControlMessage.Bye
        assertEquals("done", bye.reason)
    }

    @Test
    fun `malformed input returns null instead of throwing`() {
        assertNull(ControlMessage.parse("not json"))
        assertNull(ControlMessage.parse("{}"))
        assertNull(ControlMessage.parse("""{"type":"unknown"}"""))
        assertNull(ControlMessage.parse("""{"type":"hello"}""")) // missing udpPort
        assertNull(ControlMessage.parse("""{"type":"config","codec":"opus"}"""))
    }
}
