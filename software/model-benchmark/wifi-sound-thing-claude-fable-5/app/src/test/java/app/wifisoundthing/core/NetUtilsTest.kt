package app.wifisoundthing.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class NetUtilsTest {

    @Test
    fun `prefers 192_168 addresses`() {
        val picked = NetUtils.pickDisplayAddress(listOf("10.0.0.5", "192.168.1.23", "172.20.0.2"))
        assertEquals("192.168.1.23", picked)
    }

    @Test
    fun `falls back through private ranges`() {
        assertEquals("10.0.0.5", NetUtils.pickDisplayAddress(listOf("172.20.0.2", "10.0.0.5")))
        assertEquals("172.20.0.2", NetUtils.pickDisplayAddress(listOf("172.20.0.2")))
    }

    @Test
    fun `loopback and link-local are never picked`() {
        assertNull(NetUtils.pickDisplayAddress(listOf("127.0.0.1", "169.254.13.1")))
    }

    @Test
    fun `empty and malformed input yield null`() {
        assertNull(NetUtils.pickDisplayAddress(emptyList()))
        assertNull(NetUtils.pickDisplayAddress(listOf("not-an-ip", "1.2.3", "300.1.1.1")))
    }

    @Test
    fun `parseHostPort accepts bare host with default port`() {
        assertEquals("192.168.1.5" to Protocol.DEFAULT_CONTROL_PORT, NetUtils.parseHostPort("192.168.1.5"))
        assertEquals("192.168.1.5" to Protocol.DEFAULT_CONTROL_PORT, NetUtils.parseHostPort("  192.168.1.5  "))
    }

    @Test
    fun `parseHostPort accepts explicit port`() {
        assertEquals("192.168.1.5" to 5000, NetUtils.parseHostPort("192.168.1.5:5000"))
    }

    @Test
    fun `parseHostPort rejects garbage`() {
        assertNull(NetUtils.parseHostPort(""))
        assertNull(NetUtils.parseHostPort("host:notaport"))
        assertNull(NetUtils.parseHostPort("host:0"))
        assertNull(NetUtils.parseHostPort("host:99999"))
        assertNull(NetUtils.parseHostPort(":5000"))
    }
}
