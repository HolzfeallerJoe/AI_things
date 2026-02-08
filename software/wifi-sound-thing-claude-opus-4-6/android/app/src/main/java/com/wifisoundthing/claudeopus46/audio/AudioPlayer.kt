package com.wifisoundthing.claudeopus46.audio

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.util.Log

/**
 * Client-side audio playback using [AudioTrack] in low-latency mode.
 *
 * A dedicated thread pulls ordered PCM frames from the [JitterBuffer] and
 * writes them to the hardware audio output.
 */
class AudioPlayer(private val config: AudioConfig) {

    companion object {
        private const val TAG = "AudioPlayer"
    }

    private var audioTrack: AudioTrack? = null
    private var playbackThread: Thread? = null

    @Volatile
    private var running = false

    /**
     * Start playback. Frames are read from [jitterBuffer] in a blocking loop.
     */
    fun start(jitterBuffer: JitterBuffer) {
        val format = AudioFormat.Builder()
            .setSampleRate(config.sampleRate)
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
            .build()

        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build()

        val bufferSize = maxOf(
            config.frameSizeBytes * config.jitterBufferDepth,
            AudioTrack.getMinBufferSize(
                config.sampleRate,
                AudioFormat.CHANNEL_OUT_STEREO,
                AudioFormat.ENCODING_PCM_16BIT
            )
        )

        audioTrack = AudioTrack.Builder()
            .setAudioAttributes(attrs)
            .setAudioFormat(format)
            .setBufferSizeInBytes(bufferSize)
            .setPerformanceMode(AudioTrack.PERFORMANCE_MODE_LOW_LATENCY)
            .build()

        audioTrack?.play()
        running = true

        playbackThread = Thread({
            Log.d(TAG, "Playback thread started")
            while (running && !jitterBuffer.stopped) {
                val frame = jitterBuffer.take()
                if (running) {
                    audioTrack?.write(frame, 0, frame.size)
                }
            }
            Log.d(TAG, "Playback thread exiting")
        }, "AudioPlayer-Thread").apply {
            priority = Thread.MAX_PRIORITY
            start()
        }
    }

    /** Stop playback and release resources. */
    fun stop() {
        running = false
        playbackThread?.join(2000)
        playbackThread = null

        try {
            audioTrack?.stop()
        } catch (e: IllegalStateException) {
            Log.w(TAG, "AudioTrack.stop() failed: ${e.message}")
        }
        audioTrack?.release()
        audioTrack = null
    }
}
