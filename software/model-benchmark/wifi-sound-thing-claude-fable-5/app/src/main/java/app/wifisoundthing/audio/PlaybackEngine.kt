package app.wifisoundthing.audio

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import app.wifisoundthing.core.AudioConfig
import app.wifisoundthing.core.JitterBuffer
import kotlin.concurrent.thread

/**
 * Pulls frames from the [JitterBuffer] at playback rate, decodes them and
 * writes PCM to an [AudioTrack]. The blocking AudioTrack.write() paces the
 * loop; while the jitter buffer refills we sleep one frame duration per poll.
 *
 * Routed through the device's current audio output, including Bluetooth.
 */
class PlaybackEngine(
    private val config: AudioConfig,
    private val jitterBuffer: JitterBuffer,
    private val onStateChanged: (buffering: Boolean) -> Unit,
    private val onError: (message: String) -> Unit,
) {
    @Volatile
    private var running = false
    private var playbackThread: Thread? = null

    fun start() {
        running = true
        playbackThread = thread(name = "audio-playback", priority = Thread.MAX_PRIORITY) {
            val channelMask = if (config.channelCount == 2) AudioFormat.CHANNEL_OUT_STEREO else AudioFormat.CHANNEL_OUT_MONO
            val minBuffer = AudioTrack.getMinBufferSize(config.sampleRate, channelMask, AudioFormat.ENCODING_PCM_16BIT)
            val frameBytes = SAMPLES_PER_AAC_FRAME * 2 * config.channelCount
            val silence = ByteArray(frameBytes)
            val frameDurationMs = SAMPLES_PER_AAC_FRAME * 1000L / config.sampleRate

            var track: AudioTrack? = null
            var decoder: AacDecoder? = null
            try {
                track = AudioTrack.Builder()
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                            .build(),
                    )
                    .setAudioFormat(
                        AudioFormat.Builder()
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                            .setSampleRate(config.sampleRate)
                            .setChannelMask(channelMask)
                            .build(),
                    )
                    .setBufferSizeInBytes(maxOf(minBuffer, frameBytes * 4))
                    .setTransferMode(AudioTrack.MODE_STREAM)
                    .setPerformanceMode(AudioTrack.PERFORMANCE_MODE_LOW_LATENCY)
                    .build()
                decoder = AacDecoder(config.sampleRate, config.channelCount, config.csd)
                decoder.start()
                track.play()

                var wasBuffering = true
                onStateChanged(true)
                while (running) {
                    when (val event = jitterBuffer.poll()) {
                        is JitterBuffer.Event.Frame -> {
                            if (wasBuffering) {
                                wasBuffering = false
                                onStateChanged(false)
                            }
                            decoder.decode(event.payload, event.ptsUs) { pcm ->
                                track.write(pcm, 0, pcm.size)
                            }
                        }
                        JitterBuffer.Event.Gap -> {
                            // Lost packet: one frame of silence keeps timing intact.
                            track.write(silence, 0, silence.size)
                        }
                        JitterBuffer.Event.Buffering -> {
                            if (!wasBuffering) {
                                wasBuffering = true
                                onStateChanged(true)
                            }
                            Thread.sleep(frameDurationMs)
                        }
                    }
                }
            } catch (e: InterruptedException) {
                // stopped
            } catch (e: Exception) {
                if (running) onError("Audio playback failed: ${e.message}")
            } finally {
                try {
                    track?.stop()
                } catch (_: Exception) {
                }
                track?.release()
                decoder?.release()
            }
        }
    }

    fun stop() {
        running = false
        playbackThread?.interrupt()
        playbackThread?.join(2000)
        playbackThread = null
    }

    companion object {
        /** AAC-LC always encodes 1024 PCM samples per frame. */
        const val SAMPLES_PER_AAC_FRAME = 1024
    }
}
