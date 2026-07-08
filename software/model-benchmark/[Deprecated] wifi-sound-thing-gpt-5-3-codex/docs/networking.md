# Networking Notes

## Transport Modes

## 1) Native UDP (Android, recommended)

- Host service: `HostForegroundService`
- Client service: `ClientForegroundService`
- Packet format: `AudioPacketCodec` (`WSA1` header + PCM payload)
- Capacitor bridge: `NativeAudioPlugin`

### Native Host Capture Path

- `captureMode=auto`:
  1. attempt MediaProjection playback capture,
  2. if unavailable/blocked, fall back to microphone capture,
  3. if playback capture starts but remains silent (protected source), switch to microphone fallback.
- `captureMode=microphone`:
  - force microphone capture.

This fallback path is intentional for higher real-world success with apps that restrict direct playback capture.

## 2) WebRTC + Signaling

- Signaling server: `tools/signaling-server.mjs`
- Runtime service: `RealtimeAudioService`
- Discovery: `HostDiscoveryService`

WebRTC mode remains available for browser and LAN test workflows.

## Native Plugin API (high level)

- `requestCapturePermission()`
- `startHost({ peers, port, sampleRate, channels, frameSize, captureMode })`
- `stopHost()`
- `startClient({ port, jitterFrames, sampleRate, channels, frameSize })`
- `stopClient()`
- `getStatus()`

## Android Requirements

Manifest additions include:
- `RECORD_AUDIO`
- `FOREGROUND_SERVICE`
- `FOREGROUND_SERVICE_MEDIA_PROJECTION`
- `FOREGROUND_SERVICE_MEDIA_PLAYBACK`
- `FOREGROUND_SERVICE_MICROPHONE`

Service declarations:
- `HostForegroundService` (`mediaProjection|microphone`)
- `ClientForegroundService` (`mediaPlayback`)

## Known Gaps

- No Opus/JNI codec yet (current native path is PCM UDP).
- No payload encryption/auth yet.
- Client-host pairing/auth is still not implemented (client now filters by host IP only).
- App/DRM capture policy can still block playback-capture for some apps, requiring microphone fallback.
