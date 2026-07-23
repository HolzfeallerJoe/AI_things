# Verification Report

Honest record of what was and was not verified during development
(2026-07-13, Windows 11 dev machine + one real Android phone over wireless ADB).

## Verified — actually executed and confirmed

### Build and static checks (dev machine)

| Check | Command | Result |
| --- | --- | --- |
| Debug APK builds | `./gradlew assembleDebug` | **BUILD SUCCESSFUL** (`app/build/outputs/apk/debug/app-debug.apk`, ~13 MB) |
| Unit tests | `./gradlew testDebugUnitTest` | **36 tests, 0 failures** (AudioPacket 5, JitterBuffer 10, ControlMessage 5, Discovery 5, OpusCsd 6, PcmChunker 5) |
| Android Lint | `./gradlew lintDebug` | **0 errors**; only informational warnings (newer dependency versions available, locale-less `String.format`, intentional no-timeout wakelocks) |

### On a real phone (model "A024", Android 16 / SDK 36, real home Wi-Fi)

Installed with `adb install -r app/build/outputs/apk/debug/app-debug.apk` and driven via
adb input; every step below was observed in screenshots and logs:

1. **App launches**; role chooser, Host and Client screens all render correctly; the
   custom launcher icon is used.
2. **Host start flow works end to end**: microphone + notification permissions, the
   system "Share your screen" consent (Entire screen), foreground service starts, status
   card shows address `192.168.178.195:53705`, ticking uptime, format **opus** (the
   platform Opus *encoder* worked on this device — the PCM fallback path was therefore
   *not* exercised on hardware, only its unit-tested chunking logic).
3. **Automatic discovery works on a real network**: the Client screen listed
   "A024 (192.168.178.195:53705)" within seconds via UDP broadcast.
4. **Full audio pipeline works**: after connecting, status showed
   *Connected — playing audio*, 0.0 % packet loss, 40–60 ms buffer. With silence the
   Opus stream idled at ~6 kbit/s; while a YouTube video played on the same phone the
   client bitrate rose to **129–140 kbit/s** and the host's captured-audio level meter
   went to full — i.e. capture → Opus encode → UDP → jitter buffer → Opus decode →
   AudioTrack all ran with real media audio. Host showed *Listeners: 1 (A024)* and
   *Data sent: 1.4 MB*.
5. **Failure and recovery (NFR-4)**: stopping the host while the client was connected
   produced the plain-language banner "Could not reach the host … Retrying…" and state
   *Connection lost — reconnecting…* (no crash). After the host pressed Start again,
   the client **reconnected automatically** and showed *Connected — playing audio*.
6. **No crashes**: `adb logcat` showed **0 fatal exceptions** for the entire session;
   both foreground services shut down cleanly after Stop/Disconnect.

Note: host and client ran on the *same* phone (via its real LAN address, through the
actual Wi-Fi stack — not loopback shortcuts), because only one physical device was
attached. This exercises the entire code path of both roles simultaneously.

## Not verified — awaits manual testing by the user

- **Two physical phones**: the acceptance scenario of REQUIREMENTS.md §6 (Phone A hosts,
  Phone B connects from a different device) was not run with two separate phones. All
  the constituent parts were exercised as described above, but cross-device behavior
  (router client-to-client forwarding, different OEM builds) needs the user's test.
- **Audible quality and latency**: no human listened to the output; end-to-end delay
  and A/V sync during shared video watching were not measured (the ~40–60 ms buffer and
  0 % loss observed are necessary but not sufficient evidence).
- **Bluetooth headphones on the client** (FR-7): playback uses standard `USAGE_MEDIA`
  routing, which follows the active output device, but this was not tested with an
  actual Bluetooth headset.
- **Capture behavior of specific streaming apps** (FR-4): YouTube was verified
  capturable. Spotify, Crunchyroll and Netflix were not tested on-device; the README
  documents the expected behavior and the level meter lets the user verify per app.
- **Long-session behavior** (NFR-5): battery/thermal over a full movie was not measured.
- **Screen-off longevity** (FR-5): the foreground services, wake locks and Wi-Fi locks
  are in place, but a long screen-off soak test was not performed.
- **PCM fallback and forced-PCM mode on hardware**: unit-tested and code-reviewed, but
  the test device's Opus encoder worked, so the fallback never triggered on-device.
- **Multiple simultaneous clients** (NFR-3): only one client was connected; fan-out is
  per-client unicast and expected to scale to several listeners, unverified in practice.

Per DELIVERABLES.md, the acceptance criteria are **not claimed as fully met**: the
single-device end-to-end run above is strong evidence, but final acceptance testing on
two real phones (steps 1–6 of REQUIREMENTS.md §6) is the user's.

## How to re-run everything

```bash
cd wifi-sound-thing-claude-fable-5-2026-07-13
./gradlew assembleDebug          # build the APK
./gradlew testDebugUnitTest      # run the 36 unit tests
./gradlew lintDebug              # static analysis
adb install -r app/build/outputs/apk/debug/app-debug.apk
```
