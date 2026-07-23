package com.fable.wifisoundthing.protocol

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DiscoveryTest {

    @Test
    fun `query is recognized`() {
        val query = Discovery.buildQuery()
        assertTrue(Discovery.isQuery(query))
    }

    @Test
    fun `query check respects datagram length`() {
        val buffer = Discovery.buildQuery().copyOf(64) // typical receive buffer
        assertTrue(Discovery.isQuery(buffer, Discovery.QUERY.length))
        assertFalse(Discovery.isQuery(buffer, 64))
        assertFalse(Discovery.isQuery(ByteArray(0), 0))
    }

    @Test
    fun `response roundtrip`() {
        val response = Discovery.buildResponse("Dominik's phone", 53705)
        val info = Discovery.parseResponse(response)!!
        assertEquals("Dominik's phone", info.name)
        assertEquals(53705, info.controlPort)
        assertEquals(Wire.PROTOCOL_VERSION, info.version)
    }

    @Test
    fun `response with unicode name survives`() {
        val response = Discovery.buildResponse("Wohnzimmer-Händy 📱", 1234)
        assertEquals("Wohnzimmer-Händy 📱", Discovery.parseResponse(response)!!.name)
    }

    @Test
    fun `malformed responses are rejected`() {
        assertNull(Discovery.parseResponse("WST1!not json".toByteArray()))
        assertNull(Discovery.parseResponse("BOGUS{\"port\":1}".toByteArray()))
        assertNull(Discovery.parseResponse("WST1!{}".toByteArray())) // missing port
        assertNull(Discovery.parseResponse("WST1!{\"port\":99999}".toByteArray())) // bad port
        assertNull(Discovery.parseResponse(ByteArray(0)))
        // A query is not a response.
        assertNull(Discovery.parseResponse(Discovery.buildQuery()))
    }
}
