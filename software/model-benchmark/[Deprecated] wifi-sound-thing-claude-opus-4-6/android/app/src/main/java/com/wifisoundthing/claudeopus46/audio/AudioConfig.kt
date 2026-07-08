package com.wifisoundthing.claudeopus46.audio

/**
 * Shared audio configuration used across capture, streaming, receiving, and playback.
 */
data class AudioConfig(
    val sampleRate: Int = 48000,
    val channels: Int = 2,
    val bitDepth: Int = 16,
    val frameSizeSamples: Int = 960,     // 20 ms at 48 kHz
    val jitterBufferDepth: Int = 3,
    val streamPort: Int = 5050,
    val discoveryPort: Int = 5051
) {
    /** Bytes per frame of raw PCM: frameSizeSamples * channels * (bitDepth / 8). */
    val frameSizeBytes: Int
        get() = frameSizeSamples * channels * (bitDepth / 8)

    /** Duration of one frame in milliseconds. */
    val frameMs: Double
        get() = (frameSizeSamples.toDouble() / sampleRate) * 1000.0
}
