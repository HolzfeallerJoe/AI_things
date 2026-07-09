package app.wifisoundthing.audio

import android.annotation.SuppressLint
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioPlaybackCaptureConfiguration
import android.media.AudioRecord
import android.media.projection.MediaProjection
import android.util.Log
import kotlin.concurrent.thread

/**
 * Captures the device's media playback audio via [AudioPlaybackCaptureConfiguration]
 * (Android 10+), encodes it to AAC-LC and delivers encoded frames on a dedicated
 * capture thread.
 *
 * Only audio with usage MEDIA / GAME / UNKNOWN can be captured, and only from
 * apps that have not opted out of playback capture (`allowAudioPlaybackCapture`).
 * Apps that opt out are simply absent from the mix — capture keeps running.
 */
class CaptureEngine(
    private val mediaProjection: MediaProjection,
    private val sampleRate: Int,
    private val channelCount: Int,
    private val bitrate: Int,
    private val onFrame: (frame: ByteArray, ptsUs: Long) -> Unit,
    private val onError: (message: String) -> Unit,
) {
    @Volatile
    private var running = false
    private var audioRecord: AudioRecord? = null
    private var encoder: AacEncoder? = null
    private var captureThread: Thread? = null

    @SuppressLint("MissingPermission") // RECORD_AUDIO is checked by HostActivity before start
    fun start() {
        val channelMask = if (channelCount == 2) AudioFormat.CHANNEL_IN_STEREO else AudioFormat.CHANNEL_IN_MONO
        val format = AudioFormat.Builder()
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setSampleRate(sampleRate)
            .setChannelMask(channelMask)
            .build()
        val captureConfig = AudioPlaybackCaptureConfiguration.Builder(mediaProjection)
            .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
            .addMatchingUsage(AudioAttributes.USAGE_GAME)
            .addMatchingUsage(AudioAttributes.USAGE_UNKNOWN)
            .build()

        val minBuffer = AudioRecord.getMinBufferSize(sampleRate, channelMask, AudioFormat.ENCODING_PCM_16BIT)
        val bufferSize = maxOf(minBuffer, CHUNK_BYTES * 4)

        val record = try {
            AudioRecord.Builder()
                .setAudioFormat(format)
                .setBufferSizeInBytes(bufferSize)
                .setAudioPlaybackCaptureConfig(captureConfig)
                .build()
        } catch (e: Exception) {
            onError("Could not start audio capture: ${e.message}")
            return
        }
        if (record.state != AudioRecord.STATE_INITIALIZED) {
            record.release()
            onError("Audio capture could not be initialized on this device.")
            return
        }

        val enc = AacEncoder(sampleRate, channelCount, bitrate)
        audioRecord = record
        encoder = enc
        running = true

        captureThread = thread(name = "audio-capture", priority = Thread.MAX_PRIORITY) {
            val bytesPerFrame = 2 * channelCount
            var totalPcmFrames = 0L
            val buffer = ByteArray(CHUNK_BYTES)
            try {
                enc.start()
                record.startRecording()
                while (running) {
                    val read = record.read(buffer, 0, buffer.size)
                    if (read <= 0) {
                        if (running) {
                            Log.w(TAG, "AudioRecord.read returned $read")
                            onError("Audio capture stopped unexpectedly (code $read).")
                        }
                        break
                    }
                    val ptsUs = totalPcmFrames * 1_000_000L / sampleRate
                    totalPcmFrames += read / bytesPerFrame
                    enc.encode(buffer, read, ptsUs, onFrame)
                }
            } catch (e: Exception) {
                if (running) onError("Audio capture failed: ${e.message}")
            } finally {
                try {
                    record.stop()
                } catch (_: Exception) {
                }
                record.release()
                enc.release()
            }
        }
    }

    fun stop() {
        running = false
        // Closing the AudioRecord unblocks the read() so the thread can exit.
        captureThread?.join(2000)
        captureThread = null
        audioRecord = null
        encoder = null
    }

    companion object {
        private const val TAG = "CaptureEngine"

        /** PCM chunk read per loop: 1024 samples * 2ch * 2B = one AAC frame's worth. */
        const val CHUNK_BYTES = 4096
    }
}
