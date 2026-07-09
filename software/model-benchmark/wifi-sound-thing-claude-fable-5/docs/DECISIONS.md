# Decision Log — WiFi Sound Thing

All decisions below were made by the implementing agent (Claude Fable 5) without user
input, as permitted by the requirements ("All design and technology decisions are the
implementer's to make"). No decision required asking the user.

---

## 1. Audio capture strategy

**Options considered**

| Option | Notes |
| --- | --- |
| A. `AudioPlaybackCapture` API via MediaProjection (Android 10+) | The official way to capture other apps' media audio. Needs one-time "screen cast" consent per session + RECORD_AUDIO permission. Apps can opt out (DRM apps do). |
| B. Microphone capture of the speaker | Works with every app, but terrible quality, picks up room noise, forces the host to play out loud — defeats the purpose. |
| C. Root/system-level capture (e.g. tinycap, ALSA) | Captures everything but requires root; unacceptable for ordinary users. |
| D. Per-app integration / media session hooks | Cannot capture arbitrary apps; not viable. |

**Chosen:** A — `AudioPlaybackCaptureConfiguration` with an `AudioRecord`, matching usages
MEDIA, GAME and UNKNOWN, inside a foreground service of type `mediaProjection`.

**Reasoning:** It is the only unrooted mechanism that captures real system media audio at
full quality. It covers the primary use case (Spotify works; Crunchyroll reportedly works)
as well as is technically possible on stock Android.

**Trade-offs accepted:** Apps that set `allowAudioPlaybackCapture=false` or use protected
usage flags (Netflix and several DRM video apps) are silent in the capture — documented
prominently in the README and in the app UI (FR-4). The scary-sounding "screen cast"
consent dialog appears each session; UI text explains that only sound is captured.

## 2. Technology stack

**Options considered**

1. **Native Android, Kotlin** — direct access to `AudioPlaybackCapture`, `MediaCodec`,
   `AudioTrack`, `NsdManager`, foreground services; no abstraction layers between us and
   the latency-critical audio path.
2. **Flutter** — good UI productivity, but the capture/codec/NSD APIs all require
   platform channels into Kotlin anyway; adds a large layer for no gain in this app.
3. **React Native** — same drawback as Flutter, plus weaker story for background services.
4. **Kivy/other** — immature for this kind of system-level audio work.

**Chosen:** Native Android app in Kotlin, classic Views + Material 3, single module,
one APK serving both roles (FR-1). Min SDK 29 (the capture API's floor), target SDK 35.

**Reasoning:** Every hard part of this project (capture, codecs, low-latency playback,
foreground services, NSD) is an Android platform API; a cross-platform framework would
just wrap the same Kotlin code. Kotlin + Views keeps the build small, fast and free.

**Trade-offs accepted:** No iOS client path (out of scope anyway). Pure-logic classes
(`core` package) are kept free of Android imports so they run as plain JVM unit tests
(NFR-7).

## 3. Network transport

**Options considered**

| Option | Notes |
| --- | --- |
| A. UDP for audio + TCP for control | Classic real-time media split. UDP: no head-of-line blocking, a lost packet costs 21 ms of audio, not a stall. TCP: reliable handshake/keepalive. |
| B. Everything over TCP | Simple, but one lost segment stalls all audio behind it (head-of-line blocking) — visible as periodic freezes on lossy Wi-Fi. |
| C. WebRTC | Excellent jitter/loss handling, but a very heavy dependency, complex signaling, and most of its machinery (NAT traversal, encryption negotiation) is unnecessary on a LAN. |
| D. RTP/RTSP via a library | Standard, but brings large dependencies for a protocol we'd still have to buffer/decode ourselves. |
| E. UDP multicast/broadcast | One packet for all clients, but Wi-Fi routers handle multicast badly (low mandatory rates, filtering) — unreliable in exactly our environment. |

**Chosen:** A — a small custom protocol. TCP control channel (framed HELLO/WELCOME/
PING/PONG/BYE messages, port 46464) plus unicast UDP audio datagrams (16-byte header:
magic, version, type, u32 sequence, u64 timestamp) fanned out per client.

**Reasoning:** Matches the real-time requirement (NFR-2) with minimal moving parts and
zero third-party dependencies (NFR-1). Unicast at ~170 kbps per client is trivially within
home-Wi-Fi budgets for several clients (NFR-3). The custom codec framing is ~200 lines of
pure Kotlin and fully unit-tested.

**Trade-offs accepted:** No encryption (LAN-only, documented); packet loss is concealed as
one frame of silence rather than retransmitted; we maintain our own (simple) protocol.

## 4. Audio format / codec

**Options considered**

| Option | Bandwidth (stereo 48 kHz) | Notes |
| --- | --- | --- |
| A. Raw PCM 16-bit | ~1.5 Mbps/client | Zero codec latency, but 10× the bandwidth; hurts with several clients or weak Wi-Fi (NFR-3), more radio time = more battery (NFR-5). |
| B. AAC-LC via `MediaCodec` | 96–256 kbps | Hardware-accelerated encode/decode on every Android device, free, ~21 ms frame + small codec delay. |
| C. Opus via libopus (NDK) | 64–128 kbps | Technically the best real-time codec, but Android has no guaranteed Opus *encoder*; shipping libopus means NDK builds and native code for marginal gain on a LAN. |
| D. Opus via pure-Java port (Concentus) | 64–128 kbps | No native code, but software encoding burns CPU/battery on the host (NFR-5) and the library is minimally maintained. |

**Chosen:** B — AAC-LC, 48 kHz stereo, default 160 kbps (user-selectable 96/256), one AAC
frame (1024 samples ≈ 21.3 ms) per UDP datagram. The decoder is configured from a 2-byte
AudioSpecificConfig computed analytically (unit-tested) and sent in the handshake.

**Reasoning:** `MediaCodec` AAC encode/decode is hardware-backed and universally available
on API 29+, costs no battery to speak of, needs no third-party or native code, and its
latency contribution (~20–40 ms) fits comfortably in the end-to-end budget (NFR-2).

**Trade-offs accepted:** ~40 ms more codec latency than raw PCM and slightly worse
loss-concealment behaviour than Opus. Total end-to-end delay (capture + encode + network +
jitter buffer + decode + output) lands around 150–250 ms with the default buffer, which is
acceptable for shared watching where the *host* screen is watched.

## 5. Host discovery

**Options considered**

| Option | Notes |
| --- | --- |
| A. NSD / mDNS (`NsdManager`, DNS-SD) | Built into Android, zero config, standard service type. Some routers/APs filter multicast. |
| B. Custom UDP broadcast beacon | Works where mDNS is filtered, but reinvents mDNS and still fails on client-isolated networks. |
| C. Manual IP entry only | Always works but hostile to non-technical users (FR-9 violated as the *only* path). |
| D. QR code pairing | Nice UX but needs camera permission and still needs a transport underneath. |

**Chosen:** A + C — `NsdManager` advertising `_wifisoundthing._tcp.` on the host and
browsing on the client (with a multicast lock held during discovery), **plus** manual
`ip[:port]` entry as an always-available fallback; the host's address is displayed
prominently (FR-6, FR-11).

**Reasoning:** NSD gives the required automatic discovery with no dependencies; manual
entry covers the routers that break multicast. Resolution requests are serialised because
`NsdManager` cannot resolve concurrently.

**Trade-offs accepted:** On networks that block both multicast and peer-to-peer traffic
(guest-Wi-Fi client isolation) nothing can work; documented with the hotspot workaround.

## 6. Jitter handling / robustness (supporting decision)

Client-side reordering jitter buffer (pure Kotlin, heavily unit-tested): playback starts
after N packets are buffered (N=3/5/10 selectable ≈ 64/107/213 ms), lost packets are
concealed as one frame of silence, late/duplicate packets dropped, and if the buffer
overfills after a stall it skips ahead so latency stays bounded instead of drifting.
Client reconnects automatically with exponential backoff (0.5 s → 8 s) and keepalive
timeouts on both sides reap dead peers (NFR-4). Chosen over an adaptive/time-stretching
buffer (à la WebRTC NetEQ) for simplicity and testability; the fixed-depth design's
worst case is a brief re-buffer, which is acceptable for this use case.

## 7. Background reliability (supporting decision)

Host runs as a foreground service of type `mediaProjection`, client as type
`mediaPlayback`, each with a status notification and Stop action (FR-5). Both hold a
partial wake lock (6 h safety cap) and a `WIFI_MODE_FULL_LOW_LATENCY` Wi-Fi lock;
the client holds a multicast lock only while discovering. Alternative — relying on the
system to keep the process alive for an active `AudioRecord`/`AudioTrack` — is not
dependable across OEM battery managers.

## 8. App icon (FR-13)

Original vector adaptive icon designed in-project (no third-party assets): a white
speaker glyph with three Wi-Fi-style arcs on an indigo→navy gradient, provided as
adaptive-icon background/foreground/monochrome layers, used as the launcher icon, the
in-app logo and the notification small icon. Vector-only (no PNGs) since min SDK 29 ≥ 26.
