package com.wifisoundthing.claudeopus46.audio

import org.junit.Assert.assertEquals
import org.junit.Test

class AudioConfigTest {

    @Test
    fun defaultValues() {
        val config = AudioConfig()
        assertEquals(48000, config.sampleRate)
        assertEquals(2, config.channels)
        assertEquals(16, config.bitDepth)
        assertEquals(960, config.frameSizeSamples)
        assertEquals(3, config.jitterBufferDepth)
        assertEquals(5050, config.streamPort)
        assertEquals(5051, config.discoveryPort)
    }

    @Test
    fun frameSizeBytes_defaultConfig() {
        val config = AudioConfig()
        // 960 samples * 2 channels * 2 bytes = 3840
        assertEquals(3840, config.frameSizeBytes)
    }

    @Test
    fun frameSizeBytes_monoConfig() {
        val config = AudioConfig(channels = 1)
        // 960 * 1 * 2 = 1920
        assertEquals(1920, config.frameSizeBytes)
    }

    @Test
    fun frameSizeBytes_customFrameSize() {
        val config = AudioConfig(frameSizeSamples = 480)
        // 480 * 2 * 2 = 1920
        assertEquals(1920, config.frameSizeBytes)
    }

    @Test
    fun frameMs_at48kHz() {
        val config = AudioConfig(sampleRate = 48000, frameSizeSamples = 960)
        assertEquals(20.0, config.frameMs, 0.001)
    }

    @Test
    fun frameMs_at44100Hz() {
        val config = AudioConfig(sampleRate = 44100, frameSizeSamples = 1024)
        // 1024 / 44100 * 1000 ≈ 23.22 ms
        assertEquals(23.22, config.frameMs, 0.01)
    }

    @Test
    fun frameMs_smallFrame() {
        val config = AudioConfig(sampleRate = 48000, frameSizeSamples = 480)
        assertEquals(10.0, config.frameMs, 0.001)
    }

    @Test
    fun customPortValues() {
        val config = AudioConfig(streamPort = 6060, discoveryPort = 6061)
        assertEquals(6060, config.streamPort)
        assertEquals(6061, config.discoveryPort)
    }
}
