# WiFi Sound

Android app that captures system audio from one phone and streams it over WiFi to other devices in real time. Built for watching Crunchyroll or listening to Spotify with multiple Bluetooth headphones simultaneously.

Ionic 8 + Angular 20 + Capacitor 7 frontend. Native Kotlin audio pipeline on Android.

## Prerequisites

- Node.js 18+
- Android Studio (with SDK 35)
- Android 10+ device (API 29+) — required for audio capture APIs
- Two or more Android devices on the same WiFi network

For Shizuku mode (recommended — only needed on the host device):
- [Shizuku](https://shizuku.rikka.app/) installed and running (see [Setting up Shizuku](#setting-up-shizuku) below)

## How to run

```bash
# Install dependencies
npm install

# Run Angular dev server (browser preview, no native features)
npm start

# Build and open in Android Studio
npm run android:studio

# Build only
npm run build

# Run tests
npm test

# Lint
npm run lint
```

To deploy to a device from Android Studio: plug in your phone via USB (or use wireless debugging), select the device, and hit Run.

## How to use

The app has two modes: **Host** and **Client**. You need at least two phones on the same WiFi network (or one phone running a hotspot with the others connected to it).

### Host (the phone playing audio)

1. Open the app and stay on the **Host** tab
2. Pick a preset or configure codec/sample rate/buffer settings
3. Optionally enter peer IP addresses (comma-separated) in the peers field
4. Tap **Start Broadcast**
5. The app will attempt to set up audio capture (see [Capture Modes](#capture-modes) below)
6. Approve any permission dialogs that appear
7. Play audio on the phone — Spotify, Crunchyroll, YouTube, anything
8. The status cards show live metrics: peer count, packets sent, uptime

### Client (the phone with headphones)

1. Open the app on a second phone and switch to the **Client** tab
2. Auto-discovery will scan for hosts on the network
3. When a host appears, select it and tap **Connect**
4. Audio from the host phone plays through this device's speaker or Bluetooth headphones
5. The status panel shows latency and buffer depth in real time

### Stopping

- Host: tap **Stop Broadcast** — the foreground service notification also disappears
- Client: tap **Disconnect**

## Capture modes

The app has two audio capture modes but only one is active at a time. There is no manual toggle — the app automatically picks the best available mode when you tap Start Broadcast. It always tries Shizuku first; if Shizuku isn't installed or you deny its permission, it falls back to Projection. The log console shows which mode was selected: `[Shizuku]` or `[Projection]`.

### Shizuku mode (recommended)

Uses Android's `REMOTE_SUBMIX` audio source via a [Shizuku](https://shizuku.rikka.app/) UserService running as the shell user (UID 2000). This is the same technique [scrcpy](https://github.com/Genymobile/scrcpy) uses for audio forwarding.

**Captures everything** — including DRM-protected apps like Spotify, Crunchyroll, and Netflix that block normal audio capture.

Trade-off: while streaming, the host phone's speaker is muted (audio is rerouted to the capture process). This is fine since the whole point is to send audio to other devices.

Requirements (host device only — clients don't need Shizuku):
- Shizuku app installed and running (see [Setting up Shizuku](#setting-up-shizuku))
- Shizuku permission granted to WiFi Sound

The app checks for Shizuku automatically on the host. If available and permitted, it uses this mode. The log console shows `[Shizuku]` when active.

### Projection mode (fallback)

Uses Android's `AudioPlaybackCapture` API via a MediaProjection grant. This is the standard approach and doesn't need any extra apps.

**Does not capture DRM-protected audio.** Apps like Spotify and Crunchyroll set `ALLOW_CAPTURE_BY_NONE`, so their audio will be silent in this mode. Works fine for YouTube, browser audio, games, and most other apps.

Requirements:
- Android 10+
- User approves the "record screen" permission dialog

The app falls back to this mode when Shizuku is not installed or permission is denied. The log console shows `[Projection]` when active.

### Which mode should I use?

| | Shizuku | Projection |
|---|---|---|
| Spotify | Yes | No (silent) |
| Crunchyroll | Yes | No (silent) |
| Netflix | Yes | No (silent) |
| YouTube | Yes | Yes |
| Browser audio | Yes | Yes |
| Games | Yes | Yes |
| Requires extra app | Yes (Shizuku) | No |
| Host speaker muted | Yes | No |

If you're using this app for Spotify or Crunchyroll — which is the main use case — install Shizuku.

## Setting up Shizuku

Shizuku is only needed on the **host device** (the phone capturing and broadcasting audio). Client devices do not need it.

Shizuku is a free, open-source app that lets WiFi Sound run a small helper process with shell privileges — enough to capture all system audio including DRM-protected streams. It does not root your device or void your warranty.

### 1. Install Shizuku

- **Google Play Store**: [Shizuku on Play Store](https://play.google.com/store/apps/details?id=moe.shizuku.privileged.api)
- **GitHub releases**: [RikkaApps/Shizuku](https://github.com/RikkaApps/Shizuku/releases) (latest: v13.6.0)
- **Official site**: [shizuku.rikka.app/download](https://shizuku.rikka.app/download/)

### 2. Start Shizuku via wireless debugging (Android 11+, no computer needed)

This is the easiest method. No USB cable or PC required.

1. Enable **Developer Options** on your phone (tap Build Number 7 times in Settings > About Phone)
2. In Developer Options, enable **USB Debugging**
3. In Developer Options, scroll to **Wireless debugging** and enable it
4. Open the **Shizuku** app and tap **Start via Wireless debugging**
5. A notification will appear — tap it, then go to Settings > Wireless debugging > **Pair device with pairing code**
6. Enter the pairing code shown in Shizuku's notification
7. Return to the Shizuku app — it should now show "Shizuku is running"

> **Note:** Due to Android limitations, Shizuku needs to be restarted after every device reboot. Repeat steps 3-7 after rebooting your phone.

### 3. Alternative: start via ADB (any Android version)

If your phone is older than Android 11 or wireless debugging doesn't work:

1. Connect your phone to a computer via USB
2. Make sure [ADB](https://developer.android.com/tools/adb) is installed on the computer
3. Run:
   ```bash
   adb shell sh /sdcard/Android/data/moe.shizuku.privileged.api/start.sh
   ```
4. The Shizuku app should now show "Shizuku is running"

> **Note:** This also needs to be repeated after every reboot.

### 4. Grant permission to WiFi Sound

The first time you start a broadcast with Shizuku running, WiFi Sound will automatically ask for Shizuku permission. Tap **Allow** in the dialog. This only needs to be done once.

For more details, see the [official Shizuku setup guide](https://shizuku.rikka.app/guide/setup/).

## Architecture

```
Host phone                          Client phone(s)
-----------                         ---------------
System audio                        UDP receiver (port 5050)
    |                                   |
    v                                   v
AudioRecord (REMOTE_SUBMIX          AudioPacket deserialize
  or AudioPlaybackCapture)              |
    |                                   v
    v                               JitterBuffer (reorder + buffer)
AudioStreamer                           |
  encode -> AudioPacket                 v
  UDP unicast to each peer          AudioPlayer (AudioTrack)
    |                                   |
    v                                   v
Discovery beacon (port 5051)        Speaker / Bluetooth
  JSON broadcast every 2s
```

- Transport: unicast UDP on port 5050 (~1.5 Mbps per peer for PCM 16-bit stereo @ 48 kHz)
- Discovery: UDP beacons on port 5051, broadcast every 2 seconds, 6-second timeout
- Codec: PCM 16-bit (clean interface for Opus swap later)
- Host runs as an Android foreground service (required for sustained audio capture)
- Client runs without a service (AudioTrack works from the plugin)

## Project structure

```
src/
  app/
    home/                          # Main host/client UI
    shared/
      plugins/wifi-sound.plugin.ts # Capacitor plugin type definitions
      services/
        wifi-sound-native.service.ts  # Angular wrapper (RxJS observables)
        host-discovery.service.ts     # UDP beacon discovery
        host-network.service.ts       # Device IP detection

android/app/src/main/
  java/com/wifisound/ui/
    MainActivity.java              # Registers WifiSoundPlugin
    audio/
      WifiSoundPlugin.kt          # Capacitor bridge (JS <-> native)
      HostForegroundService.kt     # Foreground service with dual capture
      RemoteAudioCaptureService.kt # Shizuku UserService (REMOTE_SUBMIX)
      ShizukuHelper.kt            # Shizuku availability/permission/binding
      AudioStreamer.kt             # UDP sender (host)
      AudioReceiver.kt            # UDP listener (client)
      AudioPlayer.kt              # AudioTrack playback (client)
      JitterBuffer.kt             # Packet reordering buffer
      AudioPacket.kt              # Wire protocol (serialize/deserialize)
      AudioConfig.kt              # Shared config (sample rate, ports, etc.)
      AudioCodec.kt               # Codec interface
      PcmCodec.kt                 # PCM passthrough codec
      DiscoveryManager.kt         # UDP beacon broadcast/listen
  aidl/com/wifisound/ui/audio/
      IRemoteAudioCapture.aidl    # Shizuku binder interface
      IFrameCallback.aidl         # Frame delivery callback
```
