package com.wifisoundthing.claudeopus46.audio;

import com.wifisoundthing.claudeopus46.audio.IFrameCallback;

/**
 * Binder interface for the Shizuku UserService that captures system audio
 * via REMOTE_SUBMIX. Runs in a shell-privileged process (UID 2000).
 */
interface IRemoteAudioCapture {
    void startCapture(int sampleRate, int channels, int frameSizeSamples, IFrameCallback callback) = 1;
    void stopCapture() = 2;
    void destroy() = 16777114;
}
