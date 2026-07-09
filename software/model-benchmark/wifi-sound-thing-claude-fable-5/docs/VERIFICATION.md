# Verification Report — WiFi Sound Thing

Implemented by Claude Fable 5 on 2026-07-08, on Windows 11 with Android Studio's JBR
(OpenJDK 21) and Android SDK Platform 35.

## What was actually executed and confirmed working

### 1. Build succeeds from a clean state

Command (project root):

```
gradlew.bat --no-daemon clean assembleDebug testDebugUnitTest
```

Result: `BUILD SUCCESSFUL in 34s` (43 tasks executed; first-ever build took ~3 min
including dependency downloads). The installable APK was produced at
`app/build/outputs/apk/debug/app-debug.apk` (~12.9 MB).

Note: during development, two Gradle invocations were accidentally run concurrently in
the same directory and one failed on locked incremental-cache files. That failure was a
build-environment collision, not a source problem; the subsequent clean single build
above succeeded with no warnings or errors.

### 2. All unit tests pass

Command:

```
gradlew.bat testDebugUnitTest
```

Result: **49 tests in 8 test classes, 0 failures, 0 errors** (verified from the JUnit
XML reports in `app/build/test-results/testDebugUnitTest/`). Covered core logic (NFR-7):

- `AudioPacketCodecTest` — UDP audio datagram encode/decode, unsigned 32-bit sequence
  numbers, garbage/truncation rejection.
- `ControlMessageTest` — TCP handshake/keepalive message framing round-trips, streams of
  back-to-back messages, malformed/oversized frame rejection.
- `JitterBufferTest` — buffering-to-playing transitions, reordering, loss→gap
  concealment, duplicates, late packets, underrun recovery, latency-bound skip-ahead.
- `AacCsdTest` — analytically generated AAC AudioSpecificConfig against known-good
  byte values.
- `RateMeterTest`, `BackoffTest`, `FormatTest`, `NetUtilsTest` — stats, reconnect
  backoff, display formatting, IP selection and `host[:port]` parsing.

### 3. The APK installs and launches on a real phone

A physical Android phone was connected via wireless ADB during development:

```
adb install -r app/build/outputs/apk/debug/app-debug.apk   ->  Success
adb shell am start -n app.wifisoundthing/.ui.MainActivity
```

Confirmed via `dumpsys`: `MainActivity` became the focused, resumed activity, the app
process stayed alive, and its logcat contained no crash / `AndroidRuntime` fatal
entries. (The phone was PIN-locked, so an on-screen screenshot of the UI could not be
captured from the development machine.)

## What was NOT verified and awaits manual testing by the user

Only one phone was reachable from the development environment, and it was locked, so
everything that needs on-screen interaction or a second device is unverified:

- **The end-to-end acceptance scenario of REQUIREMENTS.md (§6) was NOT tested.**
  Host capture → network → client playback between two real phones has not been run.
- Audio playback capture itself (Android's MediaProjection consent flow, the
  RECORD_AUDIO permission flow, and capture of Spotify/Crunchyroll/etc.).
- Real end-to-end latency and whether it feels comfortable for shared video watching
  (NFR-2), including the three buffering presets.
- Automatic host discovery via mDNS on a real router, and the manual-address fallback.
- Playback through Bluetooth headphones on a client.
- Behaviour under real network problems (Wi-Fi dropouts, walking out of range) — the
  reconnect/backoff and jitter-buffer logic is unit-tested, but not exercised over a
  real flaky network.
- Long-session behaviour: background/screen-off streaming for a full movie, battery and
  thermal impact (FR-5, NFR-5), and OEM battery-manager interference.
- Which specific apps are capturable on the user's devices (FR-4 list in the README is
  based on documented platform behaviour, not on-device testing of each app).
- The launcher icon, notifications and all UI screens render as designed (code and
  resources compile and the activity resumes, but no visual inspection was possible).

**Conclusion:** build, automated tests, installation and crash-free launch are genuinely
verified. The acceptance criteria as a whole are **not** claimed as met — final
acceptance testing on two real phones must be performed by the user, following the
README usage guide.
