# Context7 Documentation Cache

> Project-specific documentation cache. Queries are cached with version tracking.
> Docs are fetched on-demand when making changes.

---

## ws@8.18.3

### Query: "Node.js WebSocketServer examples for connection events, room management, broadcasting JSON messages, ping/pong keepalive, and graceful close"
> Queried: 2026-02-07

- `WebSocketServer` exposes `clients` for broadcast loops.
- Keepalive pattern: mark `isAlive`, use `pong` to restore, `ping` every interval, terminate dead sockets.
- Route JSON envelopes (`offer`/`answer`/`ice-candidate`) by target socket ID and validate required fields.
- Graceful shutdown: close clients with status code before terminating server.

---

## mdn-content@web-api

### Query: "WebRTC RTCPeerConnection addTrack ontrack createOffer createAnswer setLocalDescription setRemoteDescription ICE candidate exchange getDisplayMedia audio constraints"
> Queried: 2026-02-07

- Modern `RTCPeerConnection` negotiation uses Promise-based `createOffer/createAnswer` and `setLocalDescription/setRemoteDescription`.
- Offer/answer flow should forward session descriptions through signaling, then exchange ICE candidates.
- Media setup pattern: capture local tracks, attach via `addTrack`, handle remote tracks in `ontrack`.
- `getDisplayMedia` can provide system/tab audio depending browser and user selection.

---

## developer.android@guide

### Query: "AudioPlaybackCaptureConfiguration MediaProjection AudioRecord foreground service mediaProjection Android 14 requirements and sample"
> Queried: 2026-02-08

- Foreground services that capture media/projection must declare matching `foregroundServiceType` values in manifest.
- MediaProjection flows require user consent via system capture prompt and runtime handling of result data.
- Service declarations and Android 14 foreground-service typing were used to shape native host/client service setup.

---

## @angular/core@20.x

### Query: "Testing utilities fakeAsync tick flushMicrotasks discardPeriodicTasks with promises and setInterval in Angular unit tests"
> Queried: 2026-02-08

- `fakeAsync` + `tick(ms)` is the standard pattern to test timer-driven async code deterministically.
- `flushMicrotasks()` is used to resolve pending Promise queues in tests.
- Angular testing docs recommend using virtual time control for `setTimeout`/`setInterval` flows instead of real delays.

---
