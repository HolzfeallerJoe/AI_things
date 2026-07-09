# FAQ: Can we get around the DRM block (e.g. via Shizuku)?

**Short answer:** Shizuku on its own will **not** get around it. Rooted/system-level
approaches technically can, but they are involved, device-specific, tend to break the very
apps you're trying to capture, and cross into legal DRM-circumvention territory. For the
normal use case there is no need — the apps that matter (Spotify, YouTube, browsers,
games) already work.

---

## Why Netflix & co. are silent in the first place

The block is **not** a normal Android permission you can grant. Two platform mechanisms
are involved, both enforced deep in the audio system (AudioFlinger / audio HAL), *below*
the app-permission layer:

1. **Per-app opt-out.** Any app can set `android:allowAudioPlaybackCapture="false"` in its
   manifest, or tag its audio with the capture policy `ALLOW_CAPTURE_BY_NONE` /
   `ALLOW_CAPTURE_BY_SYSTEM`. Netflix, Disney+, Amazon Prime Video and similar DRM apps do
   this. `AudioPlaybackCapture` (what our app uses) is required by the OS to honour that
   flag, so those streams are simply excluded from the mix we receive — we get silence, not
   an error.

2. **`CAPTURE_AUDIO_OUTPUT`.** The only way to capture output while *ignoring* the opt-out
   is this permission — and it is `signature|privileged`. It can only be held by apps
   signed with the platform key or placed on the privileged system partition. It is **not**
   a runtime permission, so it cannot be granted with `pm grant`.

This is the key fact for your question: the restriction lives below the permission layer,
and the escape hatch is a signature permission — so "just get more privileges" isn't
enough unless those privileges reach system/signature level.

## What Shizuku actually gives you

Shizuku runs a helper started over ADB (or via root) and lets an ordinary app call
system APIs with **shell / ADB privileges (UID 2000)** — or with **root**, if the device
is rooted and you start Shizuku that way.

**Shizuku in its normal (non-root, ADB) mode → cannot bypass the DRM block:**

- The shell user does **not** hold `CAPTURE_AUDIO_OUTPUT`, and can't grant it to itself or
  to us (it's signature|privileged, not runtime — `pm grant` refuses it).
- Shell privilege can't hook or modify the target app, and can't patch AudioFlinger.
- There is no shell command that captures internal audio while ignoring the capture
  policy (`screenrecord` doesn't capture internal audio at all; OEM screen recorders that
  do still go through the same policy and record silence for these apps).

So wiring Shizuku into this app would add complexity and a dependency for **zero** gain
against Netflix-style apps.

## What *would* technically work (and why it's a bad trade)

All of these require **root** (or an unlocked/custom system), not just Shizuku:

- **HAL / AudioFlinger-level capture** — grab the final mixed output below the policy
  layer (root "internal audio recorder" tools do this). Bypasses the opt-out because it
  happens beneath it.
- **Xposed/LSPosed hook** — force the target app's `allowAudioPlaybackCapture` / capture
  policy to "allow", or hook our own capture request. Needs root + a framework module.
- **Make our app privileged** — Magisk-mount it as a system/privileged app and whitelist
  `CAPTURE_AUDIO_OUTPUT`, or sign with the platform key. Needs root + per-device setup.

Why it's usually not worth it:

- **It breaks the target apps.** Rooting trips Play Integrity / SafetyNet. Netflix,
  Disney+, etc. detect that and refuse to play HD (or at all) — so you win the capture
  and lose the content.
- **Not portable.** Every step is device-, OEM- and Android-version-specific; nothing you
  can ship to "a non-technical user presses Start."
- **Legal.** Deliberately circumventing a DRM/technical protection measure is restricted
  in many jurisdictions (US DMCA §1201, EU Copyright Directive Art. 6, German UrhG §95a),
  independent of what you do with the audio. Capturing apps that *allow* capture (which is
  what this project does) does not raise that issue; forcing past an explicit opt-out
  does.

## Recommendation

- **Do nothing special.** The primary use cases already work: Spotify, YouTube, browsers,
  games, podcasts, local video, and (currently) Crunchyroll all allow capture. This app
  covers them today without root or Shizuku.
- **If a specific DRM app is a must-have**, the clean, legal, root-free route is to bypass
  the software path entirely with hardware: play it on the host and feed the audio out
  through the **3.5 mm jack or a Bluetooth transmitter** into whatever you like. That
  sidesteps the capture policy without touching the OS — at the cost of extra hardware and
  the host's own audio going analog.
- **Adding Shizuku to the app is not recommended** — in its standard mode it doesn't
  defeat the block, and requiring root would contradict the project's "free, no special
  setup, non-technical user" goals (NFR-1, FR-9) while breaking the DRM apps it targets.
