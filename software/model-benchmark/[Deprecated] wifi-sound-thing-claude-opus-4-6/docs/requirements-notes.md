# Wi-Fi Audio Splitter Requirements

## Context
- Nothing Phone 3 and most Android builds cannot duplicate one A2DP stream across two Bluetooth sinks.
- Prior chats converge on a Wi-Fi based relay: one host captures system playback and multicasts to clients on the LAN, each routing audio to its own headphones.
- Angular + Ionic front end is considered for control surfaces; native Android (via Capacitor plugin) handles capture and playback.

## Functional Requirements
- Host mode must capture media playback audio after the user grants MediaProjection permission and expose controls to start, stop, and monitor the stream.
- Client mode must discover or accept host endpoints, receive UDP audio packets, buffer them for jitter control, and push frames to `AudioTrack`.
- UI needs a simple toggle between host and client roles, peer management (IP entry or discovery), and real-time status (latency, packet loss, active peers).
- Provide ability to adjust audio parameters (sample rate, frame size, codec selection) with safe defaults provided.
- Support optional Opus encoding to reduce bandwidth while keeping a fallback to raw PCM for debugging.
- Persist last-used configuration locally so the user does not re-enter peers or buffer sizes.
- Surface the host device's current IP address (including hotspot defaults) so clients can identify the broadcaster without manual entry.

## Non-Functional Requirements
- Target end-to-end latency below 120 ms on stable Wi-Fi; expose telemetry so users can tune buffers.
- Handle network interruptions gracefully by muting audio and attempting reconnection without app restarts.
- Keep CPU usage modest (<40% on mid-tier Android devices) to avoid thermal throttling during long sessions.
- Ensure the host runs as a foreground service with clear notification controls to satisfy Android background policies.
- Provide unit tests for Angular services and utilities; plan for instrumentation tests of the Capacitor plugin once native code is in place.

## Technical Notes
- UDP payload should include sequence number, timestamp in microseconds, codec id, and payload length for validation.
- A small jitter buffer (e.g., 2-4 frames) reduces dropouts; add adaptive resampling hooks to trim or stretch when drift accumulates.
- Consider MDNS/SSDP broadcasting for zero-config client discovery; fall back to manual IP entry.
- The Ionic prototype currently simulates host discovery; swap in real LAN beacon scanning once backend support exists.
- MediaProjection prompts expire after reboot; guide the user through renewal when necessary.
- For Opus, bundle a JNI bridge or use an existing Java wrapper; document licensing obligations.
- When raw PCM is used, enforce LAN-only usage or provide warnings about bandwidth (approx. 1.5 Mbps for 48 kHz stereo 16-bit).

## UX Ideas
- Show connection cards per client with indicators for signal quality, current delay, and reconnect button.
- Offer preset profiles (Movie Night, Low Latency, Battery Saver) that tweak codec and buffer combinations.
- Provide a quick link to troubleshooting tips drawn from `convWithGPT.md` when Bluetooth-only solutions are requested.

## Open Questions
- Should the host support multicast/broadcast UDP, or remain unicast to each client?
- What encryption, if any, is required for LAN packets?
- Do we target desktop receivers (Electron, web) in addition to Android clients?
- How should we package and deliver the Capacitor plugin for reuse across projects?
