package com.wifisoundthing.claudeopus46.audio

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log

/**
 * Shizuku UserService that captures the entire system audio mix via
 * REMOTE_SUBMIX. This class runs in a separate process as UID 2000 (shell),
 * which holds the CAPTURE_AUDIO_OUTPUT permission in AOSP.
 *
 * REMOTE_SUBMIX captures ALL audio output — including DRM-protected apps
 * like Spotify and Crunchyroll that opt out of AudioPlaybackCapture.
 *
 * Trade-off: while this service is recording, device speaker output is
 * silenced (audio is rerouted to the capture process). This is acceptable
 * for the WiFi Sound use case because the audio is being sent to external
 * headphones/speakers via the streaming pipeline.
 *
 * Communication: frames are delivered to the host app via the
 * [IFrameCallback] binder interface (~3840 bytes per frame at 20 ms
 * intervals = ~192 KB/s, well within binder limits).
 */
class RemoteAudioCaptureService : IRemoteAudioCapture.Stub() {

    companion object {
        private const val TAG = "RemoteAudioCapture"
    }

    @Volatile
    private var capturing = false
    private var audioRecord: AudioRecord? = null
    private var captureThread: Thread? = null

    /**
     * Start capturing system audio via REMOTE_SUBMIX.
     *
     * This method is called from the host app's process via Shizuku binder.
     * It runs in the shell-privileged process.
     */
    override fun startCapture(
        sampleRate: Int,
        channels: Int,
        frameSizeSamples: Int,
        callback: IFrameCallback?
    ) {
        if (capturing) {
            Log.w(TAG, "Already capturing — ignoring duplicate startCapture")
            return
        }
        if (callback == null) {
            Log.e(TAG, "No callback provided — cannot deliver frames")
            return
        }

        val channelMask = if (channels == 1)
            AudioFormat.CHANNEL_IN_MONO
        else
            AudioFormat.CHANNEL_IN_STEREO

        val bitDepth = 16
        val frameSizeBytes = frameSizeSamples * channels * (bitDepth / 8)

        val audioFormat = AudioFormat.Builder()
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setSampleRate(sampleRate)
            .setChannelMask(channelMask)
            .build()

        val minBuf = AudioRecord.getMinBufferSize(
            sampleRate, channelMask, AudioFormat.ENCODING_PCM_16BIT
        )
        val bufSize = maxOf(frameSizeBytes * 4, minBuf)

        try {
            @Suppress("DEPRECATION") // MediaRecorder.AudioSource constants
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.REMOTE_SUBMIX,
                sampleRate,
                channelMask,
                AudioFormat.ENCODING_PCM_16BIT,
                bufSize
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create AudioRecord with REMOTE_SUBMIX: $e")
            return
        }

        if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
            Log.e(TAG, "AudioRecord failed to initialise (state=${audioRecord?.state})")
            audioRecord?.release()
            audioRecord = null
            return
        }

        capturing = true
        audioRecord?.startRecording()

        captureThread = Thread({
            Log.d(TAG, "REMOTE_SUBMIX capture started ($sampleRate Hz, frame=$frameSizeBytes B)")
            val buffer = ByteArray(frameSizeBytes)

            while (capturing) {
                val bytesRead = audioRecord?.read(buffer, 0, buffer.size) ?: -1
                if (bytesRead == frameSizeBytes) {
                    try {
                        callback.onFrame(buffer.copyOf())
                    } catch (e: Exception) {
                        Log.w(TAG, "Frame callback failed (client disconnected?): $e")
                        break
                    }
                } else if (bytesRead < 0) {
                    Log.w(TAG, "AudioRecord.read() returned $bytesRead")
                    break
                }
            }

            Log.d(TAG, "REMOTE_SUBMIX capture thread exiting")
        }, "RemoteSubmix-Capture").apply {
            priority = Thread.MAX_PRIORITY
            start()
        }
    }

    override fun stopCapture() {
        if (!capturing) return
        capturing = false

        captureThread?.join(3000)
        captureThread = null

        try { audioRecord?.stop() } catch (_: Exception) { }
        audioRecord?.release()
        audioRecord = null

        Log.d(TAG, "REMOTE_SUBMIX capture stopped")
    }

    override fun destroy() {
        stopCapture()
        Log.d(TAG, "RemoteAudioCaptureService destroyed")
        System.exit(0)
    }
}
