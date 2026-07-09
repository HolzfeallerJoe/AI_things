# Project Requirements: Wi-Fi Audio Splitter ("WiFi Sound Thing")

This document is a complete, self-contained specification. It is intended to be handed to
any developer or AI agent as the single source of truth for building this application from
scratch. Do not assume any prior code, prior projects, or existing decisions beyond what is
written here. All design and technology decisions are the implementer's to make.

## 0. Setup — do this before anything else

1. In the current working directory, create a new folder named
   `wifi-sound-thing-<model>`, where `<model>` identifies you, the implementing model or
   agent (e.g. your model name or ID, lowercased, with spaces/dots replaced by hyphens).
2. Create a `docs` folder inside it and copy this requirements file and the accompanying
   `DELIVERABLES.md` to `wifi-sound-thing-<model>/docs/`.
3. Do all project work inside `wifi-sound-thing-<model>` — nothing outside that folder may
   be created or modified.

## 1. Problem statement

Android phones generally cannot play one audio stream to two Bluetooth headphones at the
same time. Two people therefore cannot watch a movie or listen to music together on one
phone, each with their own headphones.

**Goal:** Let one phone (the *host*) capture whatever audio it is playing — streaming apps,
video apps, browser, games — and transmit it in real time over the local Wi-Fi network to
one or more other phones (the *clients*). Each client plays the received audio through its
own output (speaker or its own Bluetooth headphones).

Primary use case: two or more people on the same Wi-Fi network (or one phone's hotspot)
watching a show or listening to music from a single host phone, e.g. Crunchyroll or Spotify.

## 2. Users and environment

- Users are private individuals; the app runs on their personal Android phones.
- Devices: modern Android phones. At least two devices are on the same LAN / Wi-Fi /
  hotspot.
- No server infrastructure exists. Everything must run on the phones themselves, or on
  software the user can start locally for free.

## 3. Functional requirements

### Roles
- **FR-1** The app must offer two roles selectable in the UI: **Host** and **Client**.
  One codebase/app for both roles is preferred.

### Host
- **FR-2** The host must capture the device's media playback audio (system audio, not just
  microphone input) and stream it to connected clients with low latency.
- **FR-3** The host must expose controls to start, stop, and monitor the broadcast
  (connected peer count, uptime, amount of data sent).
- **FR-4** Be aware that some popular media apps restrict how their audio can be captured
  by other apps. Since streaming apps such as Spotify and Crunchyroll are the primary use
  case, the solution must state clearly which apps it can and cannot capture, and should
  aim to cover the primary use case as well as technically possible.
- **FR-5** The host must keep capturing and streaming reliably while the app is in the
  background and the screen is off.

### Client
- **FR-6** The client must be able to discover hosts on the network automatically, and
  also allow manual entry of a host address as a fallback.
- **FR-7** The client must receive the audio stream, cope with imperfect network
  conditions (delay variation, loss, reordering), and play the audio through the device's
  current audio output, including Bluetooth headphones.
- **FR-8** The client must show live status: connection state and stream health.

### Configuration and UX
- **FR-9** Sensible defaults must let a non-technical user simply press "Start" on the
  host and "Connect" on the client. Tunable settings may be offered for advanced users.
- **FR-10** The last-used configuration must persist across app restarts.
- **FR-11** The host's network address must be visible in the UI so users can connect
  manually if automatic discovery fails.
- **FR-12** Errors and state changes (permission denied, peer lost, connection dropped)
  must be surfaced to the user in plain language, not only in logs.
- **FR-13** An app icon must be created or generated for the app and actually used as its
  launcher icon (and, where applicable, splash/branding imagery) — the default placeholder
  icon of the chosen framework is not acceptable. The icon must be an original design or
  generated asset that does not infringe third-party rights (NFR-1 applies: no paid icon
  packs or licensed artwork).

## 4. Non-functional requirements

- **NFR-1 Cost:** The final product must be completely free to build, run, and use. No paid
  services, paid APIs, paid libraries, licensing fees, or required subscriptions. Free and
  open-source dependencies are fine.
- **NFR-2 Latency:** End-to-end delay must be low enough that audio on the clients feels
  in sync with video playing on the host during shared watching.
- **NFR-3 Bandwidth:** The stream must work comfortably on an ordinary home Wi-Fi network
  with several clients connected.
- **NFR-4 Robustness:** Network interruptions must be handled gracefully — recover
  automatically rather than crashing or requiring an app restart.
- **NFR-5 Efficiency:** Resource usage must be modest enough that a long session (a full
  movie) does not overheat the phone or drain the battery excessively.
- **NFR-6 Privacy:** Audio stays on the local network. No audio data may leave the LAN or
  be sent to any third-party service.
- **NFR-7 Testing:** Core logic should be covered by automated tests where the chosen
  stack reasonably allows it.

## 5. Technology constraints

- The technology stack, architecture, protocols, and all implementation techniques are
  **deliberately left open** — choose whatever best solves the problem, subject to NFR-1
  (everything free).
- The host must be an Android phone; clients must at minimum include Android phones.

## 6. Acceptance criteria

The project is done when this scenario works end to end:

1. Two Android phones are on the same Wi-Fi network.
2. Phone A opens the app, chooses Host, completes any one-time setup the solution
   requires, and starts broadcasting.
3. Phone A plays audio from a streaming app.
4. Phone B opens the app, chooses Client, sees Phone A appear automatically, and connects.
5. Phone B hears Phone A's audio through its own Bluetooth headphones with delay low
   enough for comfortable shared video watching.
6. Stopping either side, losing Wi-Fi briefly, or switching tracks does not crash the app;
   recovery works without reinstalling or rebooting.
