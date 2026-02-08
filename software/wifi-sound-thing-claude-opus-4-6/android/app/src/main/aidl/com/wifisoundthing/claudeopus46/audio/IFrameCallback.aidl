package com.wifisoundthing.claudeopus46.audio;

/**
 * Callback interface for receiving PCM audio frames from the
 * Shizuku UserService (RemoteAudioCaptureService).
 */
interface IFrameCallback {
    void onFrame(in byte[] pcmData);
}
