# Shizuku REMOTE_SUBMIX Audio Capture - Implementation Plan

## Goal
Add Shizuku-based REMOTE_SUBMIX audio capture as the primary capture method. This bypasses per-app AudioPlaybackCapture opt-out (Spotify, Crunchyroll, etc.) by running an AudioRecord with REMOTE_SUBMIX source in a shell-privileged process (UID 2000) via Shizuku's UserService.

## How it works
- Shizuku runs a Java process as the Android shell user (UID 2000)
- The shell user has `CAPTURE_AUDIO_OUTPUT` permission in AOSP
- `AudioRecord` with `MediaRecorder.AudioSource.REMOTE_SUBMIX` captures the entire system audio mix
- This is the same technique scrcpy uses to capture all audio including DRM-protected apps
- Trade-off: device speaker is muted while capturing (audio rerouted to capture process)

## Architecture: Dual capture mode
- **Shizuku mode** (primary): UserService creates AudioRecord with REMOTE_SUBMIX, sends frames via AIDL binder callback
- **Projection mode** (fallback): Existing MediaProjection + AudioPlaybackCapture code, used when Shizuku is unavailable

## Changes

### Phase 1: Shizuku dependency + manifest
**Files:** `android/app/build.gradle`, `AndroidManifest.xml`
- Add `dev.rikka.shizuku:api:13.1.5` and `dev.rikka.shizuku:provider:13.1.5` dependencies
- Add `mavenCentral()` to repositories
- Add ShizukuProvider to manifest
- Add `FOREGROUND_SERVICE_MEDIA_PLAYBACK` permission (for Shizuku mode foreground service)
- Update service to `foregroundServiceType="mediaProjection|mediaPlayback"`

### Phase 2: AIDL interfaces
**New files:** `IRemoteAudioCapture.aidl`, `IFrameCallback.aidl`
- `IFrameCallback`: `void onFrame(in byte[] pcmData)` - callback for receiving audio frames
- `IRemoteAudioCapture`: `void startCapture(int sampleRate, int channels, int frameSizeSamples, IFrameCallback callback)`, `void stopCapture()`, `void destroy()`

### Phase 3: Shizuku UserService
**New file:** `RemoteAudioCaptureService.kt`
- Extends `IRemoteAudioCapture.Stub`
- Creates `AudioRecord` with `MediaRecorder.AudioSource.REMOTE_SUBMIX`
- Capture thread reads frames and sends via `IFrameCallback.onFrame()`
- Runs as UID 2000 (shell) with `CAPTURE_AUDIO_OUTPUT` permission

### Phase 4: ShizukuHelper
**New file:** `ShizukuHelper.kt`
- `isAvailable()`: Check if Shizuku is installed and running
- `hasPermission()`: Check if our app has Shizuku permission
- `requestPermission()`: Request permission from user
- `bindAudioCapture()`: Bind the UserService, return binder

### Phase 5: Refactor HostForegroundService
**Modified file:** `HostForegroundService.kt`
- Add `EXTRA_CAPTURE_MODE` ("shizuku" or "projection")
- In Shizuku mode: bind UserService, receive frames via callback, feed to AudioStreamer
- In projection mode: existing AudioPlaybackCapture code (unchanged)
- Use `FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK` for Shizuku, `MEDIA_PROJECTION` for projection
- Speaker muting only happens in Shizuku mode (inherent to REMOTE_SUBMIX)

### Phase 6: Update WifiSoundPlugin
**Modified file:** `WifiSoundPlugin.kt`
- Add `checkShizuku()` method: returns { available, granted }
- Add `requestShizukuPermission()` method: triggers Shizuku permission dialog
- Modify `startHost()`: accept optional `captureMode` param, auto-detect if not specified
- When captureMode="shizuku": skip MediaProjection, pass EXTRA_CAPTURE_MODE to service
- When captureMode="projection": existing flow (requires requestMediaProjection first)

### Phase 7: TypeScript plugin + service
**Modified files:** `wifi-sound.plugin.ts`, `wifi-sound-native.service.ts`
- Add `ShizukuStatus` interface: `{ available: boolean, granted: boolean }`
- Add `checkShizuku(): Promise<ShizukuStatus>` to plugin interface
- Add `requestShizukuPermission(): Promise<boolean>` to plugin interface
- Add `captureMode?: 'shizuku' | 'projection'` to `StartHostOptions`
- Update native service with new methods

### Phase 8: Update home page
**Modified file:** `home.page.ts`
- On init: check Shizuku availability
- In `startHost()`:
  - If Shizuku available+granted: use shizuku mode (no MediaProjection dialog)
  - If Shizuku available but not granted: request permission, then use shizuku mode
  - If Shizuku not available: fall back to MediaProjection mode
- Show capture mode indicator in log ("Shizuku mode - full audio capture" vs "Projection mode - limited capture")
- Show guidance message when Shizuku not available

### Phase 9: Build + test
- `ng build` + `ng lint` + `ng test`
- Fix any compilation or test issues
