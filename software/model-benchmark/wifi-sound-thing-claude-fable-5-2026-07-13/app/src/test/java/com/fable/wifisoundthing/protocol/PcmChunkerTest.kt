package com.fable.wifisoundthing.protocol

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PcmChunkerTest {

    @Test
    fun `one 20ms block becomes four 5ms datagrams`() {
        val block = ByteArray(3840) { it.toByte() }
        val chunks = PcmChunker.chunk(block)
        assertEquals(4, chunks.size)
        assertTrue(chunks.all { it.size == Wire.PCM_CHUNK_BYTES })
        // Reassembly gives back the original block.
        val reassembled = chunks.reduce { acc, bytes -> acc + bytes }
        assertArrayEquals(block, reassembled)
    }

    @Test
    fun `chunk sizes are aligned to whole sample frames`() {
        val chunks = PcmChunker.chunk(ByteArray(1000), chunkBytes = 130, frameBytes = 4)
        for (chunk in chunks.dropLast(1)) {
            assertEquals(128, chunk.size) // 130 aligned down to a multiple of 4
        }
    }

    @Test
    fun `short final chunk is kept`() {
        val chunks = PcmChunker.chunk(ByteArray(1000))
        assertEquals(2, chunks.size)
        assertEquals(960, chunks[0].size)
        assertEquals(40, chunks[1].size)
    }

    @Test
    fun `respects explicit length`() {
        val chunks = PcmChunker.chunk(ByteArray(4096), length = 960)
        assertEquals(1, chunks.size)
        assertEquals(960, chunks[0].size)
    }

    @Test
    fun `every chunk fits in a single datagram`() {
        val chunks = PcmChunker.chunk(ByteArray(20_000))
        assertTrue(chunks.all { it.size + Wire.HEADER_BYTES <= Wire.MAX_PACKET_BYTES })
    }
}
