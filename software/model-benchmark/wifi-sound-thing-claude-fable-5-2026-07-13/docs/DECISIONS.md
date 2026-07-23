# Decision Log

All decisions below were made by the implementing agent (Claude Fable 5) based on the
requirements and on web research; the user was not asked, because none of the choices
had trade-offs that required user input (per the project prompt, questions were reserved
for genuinely user-facing decisions).

---

## 1. Audio capture strategy

**Options considered**

1. **AudioPlaybackCapture API** (Android 10+): a MediaProjection-backed `AudioRecord`
   that captures other apps' playback (usages MEDIA/GAME/UNKNOWN) unless they opt out.
2. Microphone capture of the phone's speaker — works with every app but terrible
   quality, echo, and it blocks using the host phone silently.
3. Root/Xposed-based capture (e.g. forcing `allowAudioPlaybackCapture`) — captures
   everything but requires rooting; unacceptable for normal users and ethically/legally
   dubious for DRM content.
4. Per-app integration (stream from the source app itself) — impossible; third-party
   apps offer no such hooks.

**Chosen:** AudioPlaybackCapture (option 1), with the required MediaProjection consent
dialog, `RECORD_AUDIO` permission, and a foreground service of type `mediaProjection`.

**Reasoning:** it is the only supported, root-free way to capture system playback audio,
which FR-2 requires. It works for the large majority of media apps because apps
targeting Android 10+ are capturable *by default*.

**Trade-offs accepted:**
- minSdk becomes 29 (Android 10) — acceptable for "modern Android phones" (FR: users
  have modern devices).
- Apps can opt out (DRM players like Netflix always; Spotify/Crunchyroll reportedly
  varies by version — web sources conflict, so the app makes this *observable*: the host
  screen shows a live captured-audio level meter plus a plain-language hint when only
  silence is captured (FR-4, FR-12). The README documents the categories honestly.
- The scary "recording/casting the screen" consent dialog must be accepted although only
  audio is used; mitigated with UI copy explaining it.

## 2. Technology stack

**Options considered**

1. **Native Android, Kotlin, classic Views + Material 3**, no third-party runtime deps.
2. Native Android with Jetpack Compose.
3. Flutter / React Native with native platform channels for capture and audio.
4. Termux/desktop helper (e.g. a PC relay server) — rejected outright: requirements say
   phones only.

**Chosen:** option 1 — Kotlin, single module, three small activities, ViewBinding,
Material 3 components; Gradle 8.10.2 / AGP 8.7.3 / Kotlin 2.0.21; minSdk 29,
targetSdk 35.

**Reasoning:** the hard parts (MediaProjection, AudioRecord/AudioTrack, MediaCodec,
foreground service types) are Android platform APIs; any cross-platform framework would
still need all of that as native code and would only add build complexity and app size.
Views over Compose keeps the build fast, the dependency surface small, and the UI is
deliberately simple (three screens). Everything used is free and open source (NFR-1).

**Trade-offs:** no iOS client (requirements only demand Android); UI code slightly more
verbose than Compose.

## 3. Network transport

**Options considered**

1. **TCP control channel + UDP audio stream** (custom, minimal).
2. TCP only (single stream) — simple, but head-of-line blocking turns one lost packet
   into a growing delay; bad for live audio.
3. RTP/RTSP stack — standard, but a full correct implementation is heavy and brings no
   benefit for a single-purpose LAN app.
4. WebRTC — excellent latency handling but a huge dependency, complex signaling, and
   designed for NAT traversal we don't need on a LAN.

**Chosen:** option 1. A TCP connection (default port 53705) carries a one-line JSON
handshake (`hello` → `config`), ping/pong keepalives and `bye`; audio flows host→client
as UDP unicast datagrams (16-byte binary header: magic, version, codec, sequence number,
timestamp) to the UDP port each client announced in its `hello`. Every datagram stays
under 1400 bytes to avoid IP fragmentation.

**Reasoning:** UDP gives audio immunity to head-of-line blocking; late packets are
simply skipped. TCP gives reliable membership, clean errors, and codec negotiation.
Unicast per client (rather than multicast) is used because Wi-Fi multicast/broadcast is
sent at low legacy data rates and is unreliable on many APs; with Opus at ~0.14 Mbit/s
per listener, several unicast streams are trivial for any home network (NFR-3).

**Trade-offs:** no retransmission or FEC — a lost packet is ~5–20 ms of concealed
silence, which is the right trade for latency on a LAN; per-client bandwidth grows
linearly (fine for the intended 2–5 listeners).

## 4. Audio format / codec

**Options considered**

1. **Opus via the platform MediaCodec encoder** (`audio/opus`, 48 kHz stereo,
   128 kbit/s, 20 ms frames) **with automatic fallback to uncompressed PCM**.
2. PCM only (48 kHz/16-bit/stereo ≈ 1.54 Mbit/s per client) — zero codec risk, higher
   bandwidth.
3. AAC via MediaCodec — encoders universally available, but AAC-LC adds noticeably more
   codec delay and MediaCodec AAC streaming without a container is fiddlier.
4. Bundling libopus via JNI — best control, but adds NDK builds and a native dependency
   for little gain.

**Chosen:** option 1. The host tries to create the platform Opus encoder at start; web
research showed `c2.android.opus.encoder` exists on Android 10+ but fails on some
devices, so on any failure the host silently falls back to PCM, and the codec is
negotiated in the handshake (`config` carries the codec and, for Opus, the `OpusHead`
from the encoder, handling Android's `AOPUSHDR` wrapper). The client decodes with the
platform Opus decoder, which is mandatory on all supported devices. A host-side setting
can force PCM as an escape hatch.

**Trade-offs:** two code paths (encoder+decoder each); Opus adds ~20–25 ms of framing/
codec delay versus raw PCM — accepted for a 10× bandwidth reduction; PCM fallback uses
~1.6 Mbit/s per listener, still fine on normal Wi-Fi.

## 5. Host discovery

**Options considered**

1. **Custom UDP broadcast probe/response** on port 53706 (`WST1?` → `WST1!{json}`).
2. Android NSD / mDNS (`NsdManager`) — standard, but notoriously flaky across OEM
   builds, slow to resolve, and historically buggy with service loss events.
3. Manual IP entry only — simplest, but fails FR-6's "automatic" requirement.

**Chosen:** option 1, plus manual entry as fallback (FR-6, FR-11). The client
broadcasts a probe (to 255.255.255.255 and each interface's subnet broadcast) every
~1.5 s while on the connect screen and lists responders; the host answers with its name
and control port. A `MulticastLock` is held where needed because some devices filter
broadcast receive otherwise.

**Reasoning:** a 30-line protocol we fully control, testable in plain JVM unit tests,
works identically on hotspots, and avoids OEM mDNS bugs.

**Trade-offs:** some routers filter broadcast between clients (then manual entry is
needed — the host's address is always shown in its UI); no IPv6-only support.

## 6. Latency handling / jitter buffer

**Options considered:** fixed prebuffer depth; fully adaptive buffer (à la WebRTC
NetEQ); no buffer (play as received).

**Chosen:** a compact sequence-ordered jitter buffer with: prebuffer target
(user preset Low/Normal/Safe = 40/60/120 ms), a 2-packet reorder window, loss
concealment (silence insertion), skip-ahead when the queue exceeds a maximum depth
(latency snaps back after network stalls instead of growing forever), stream reset
detection on large sequence jumps, and re-prebuffering after underruns. Playback pacing
comes from blocking `AudioTrack` writes (low-latency mode).

**Trade-offs:** silence PLC is cruder than Opus's decoder-side concealment but far
simpler; a fixed target adds a constant ~40–120 ms — predictable and user-tunable, which
matters more than the last 20 ms for shared video watching (NFR-2).

## 7. Background reliability (FR-5) and robustness (NFR-4)

- Host: foreground service `mediaProjection` type; client: `mediaPlayback` type — both
  with persistent notifications and stop/disconnect actions.
- Both sides hold a `WIFI_MODE_FULL_LOW_LATENCY` WifiLock and a partial WakeLock so
  Wi-Fi and CPU stay responsive with the screen off. Accepted battery cost is documented.
- The client auto-reconnects with capped exponential backoff (1→8 s) until the user
  disconnects; the host survives client loss trivially (per-client threads/sockets).
  MediaProjection revocation (system/user) is caught via callback and surfaced in plain
  language.

## 8. App icon (FR-13)

Hand-authored original vector adaptive icon (no third-party assets): a white speaker
emitting waves toward two dots (two listeners) on a navy→teal gradient, provided as
adaptive-icon background/foreground/monochrome layers. Because minSdk is 29 (≥ 26), no
legacy PNG mipmaps are needed; Android 12+ derives the splash screen from the same icon.

## 9. Ports and defaults

Control TCP 53705, discovery UDP 53706 — high, unassigned ports chosen to avoid clashes
(including with the earlier benchmark implementation living beside this one, which uses
different defaults and a different application id, so both apps can be installed
side by side). Defaults follow FR-9: host = press Start, client = tap the discovered
host; every persisted setting (device name, codec mode, last host address, buffer
preset) has a sensible default (FR-10 via SharedPreferences).
