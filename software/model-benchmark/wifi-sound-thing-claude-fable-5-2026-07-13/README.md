# WiFi Sound Thing

**What it is:** An Android app that lets one phone (the **host**) share whatever audio it
is playing — videos, music, games — with other phones (**clients**) over the local Wi-Fi
network in real time. Each client plays the audio through its own speaker or Bluetooth
headphones, so two or more people can watch a movie or listen to music together from a
single phone. Audio never leaves your Wi-Fi network.

One app covers both roles: open it and choose **Host** or **Listen**.

---

## Prerequisites

Everything needed is free:

| Tool | Version | Where to get it |
| --- | --- | --- |
| Android Studio (includes the Android SDK and a suitable JDK) | Any recent version (2024+) | <https://developer.android.com/studio> (free) |
| Two Android phones | **Android 10 or newer** (the audio-capture feature requires it) | — |
| USB cable or Wi-Fi debugging | — | to install the app on the phones |

If you prefer the command line only, you need: JDK 17+, the Android SDK with
*platform android-35* and *build-tools*, and the `ANDROID_HOME` environment variable
pointing at the SDK. Installing Android Studio once is the easiest way to get all of that.

## Build instructions

From a fresh checkout, in this folder:

```bash
# Windows
gradlew.bat assembleDebug

# macOS / Linux
./gradlew assembleDebug
```

The installable app appears at `app/build/outputs/apk/debug/app-debug.apk`.

**Install it on each phone** (host and every listener use the same app):

1. Enable *Developer options* on the phone: Settings → About phone → tap *Build number*
   7 times.
2. Enable *USB debugging* in Settings → Developer options, and plug the phone in.
3. Run:

   ```bash
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```

   (`adb` is in `<Android SDK>/platform-tools`. With several phones connected, use
   `adb devices` to list them and `adb -s <serial> install …` per phone.)

Alternatively, open this folder in Android Studio and press **Run** with the phone
connected — that builds and installs in one step. You can also copy `app-debug.apk` to a
phone (e.g. via a file share) and open it there to install it, if you allow installing
from unknown sources.

**Run the automated tests:**

```bash
gradlew.bat testDebugUnitTest        # Windows
./gradlew testDebugUnitTest          # macOS / Linux
```

## Usage guide

Both phones must be connected to the **same Wi-Fi network**. A phone hotspot also works:
one phone opens a hotspot, the other joins it (either one can be the host).

### On the host phone (the one playing the movie/music)

1. Open **WiFi Sound Thing** and tap **Host**.
2. Optional: set the name listeners will see, and leave the audio format on
   *Compressed (Opus)*.
3. Tap **Start broadcasting**.
4. One-time setup, only the first time: allow the **microphone** permission (Android
   requires it for capturing playback audio — the actual microphone is not recorded)
   and, on Android 13+, allow **notifications**.
5. A system dialog asks to *start recording or casting the screen*. Choose
   **Start now** / **Entire screen**. Only audio is used; the screen content is not
   captured or sent anywhere.
6. The status card now shows **Broadcasting**, this phone's address, the number of
   listeners, and a live *Captured audio level* meter.
7. Start your movie or music. The level meter must move — if it stays at zero, the app
   you are playing from blocks audio capture (see *Known limitations*).
8. You can switch apps or turn the screen off; the broadcast keeps running. Stop it with
   the **Stop** button in the app or in the notification.

### On each listening phone

1. Connect your Bluetooth headphones to *this* phone as usual (or just use its speaker).
2. Open **WiFi Sound Thing** and tap **Listen**.
3. The host should appear in the list within a few seconds — tap it.
   *If it does not appear:* type the address shown on the host's screen (e.g.
   `192.168.1.23`) into *Connect by address* and tap **Connect**.
4. Allow notifications if asked (Android 13+, first time only).
5. The status card shows **Connected — playing audio** together with packet loss,
   buffer, and bitrate. Audio now plays through this phone's output.
6. If the sound stutters, pick the *Safe* buffering option (more delay, fewer dropouts)
   before connecting; *Low delay* does the opposite.
7. Disconnect with the button in the app or in the notification.

Brief Wi-Fi drops are handled automatically — the client reconnects by itself. The last
used settings (name, address, buffering, format) are remembered.

## Known limitations

- **Which apps can be captured (important):** Android only lets an app be captured if it
  does not opt out. In practice:
  - **Works:** YouTube, most browsers (Chrome, Firefox), most games, podcast apps, local
    video/music players (VLC etc.), and most apps without DRM-protected content.
  - **Does not work (capture is silent):** Netflix and most banking/DRM-protected
    players. These apps deliberately block audio capture at the system level; no app can
    capture them without rooting the phone.
  - **May or may not work:** Spotify and Crunchyroll have changed their capture policy
    over time and it can differ by app version and region. **How to check:** start
    broadcasting, play something, and watch the *Captured audio level* meter on the host
    screen — if it moves, the app is capturable; if it stays at zero, that app blocks
    capture. A practical workaround for music is to play via the service's web player in
    Chrome/Firefox, which is usually capturable.
  - Phone calls and other apps' voice-call audio are never captured (system restriction).
- **Delay:** end-to-end delay is roughly 100–200 ms on a good network, which most people
  find acceptable for shared video watching. The *client's own Bluetooth headphones* add
  their usual extra delay (often 100–200 ms more depending on the headset); wired or
  speaker output on the client is noticeably tighter for lip-sync.
- **Host's own playback is not delayed**, so the host phone's speaker and a client's
  headphones will not be perfectly in sync with each other; the intended use is that
  every person listens via the app (host uses their own wired/Bluetooth headphones on
  the host phone directly).
- **Same network required:** both phones must be on the same Wi-Fi/hotspot subnet. Guest
  networks or public hotspots with *AP/client isolation* block phone-to-phone traffic
  entirely — the app cannot work there.
- **Automatic discovery** uses UDP broadcast, which a few routers filter. Manual
  connection by address always remains available (the host's address is shown on its
  screen).
- Some phones lack a working system **Opus encoder**; the app then falls back to
  uncompressed audio automatically (~1.6 Mbit/s per listener instead of ~0.14 Mbit/s).
  You can also force this with the *Uncompressed (PCM)* setting.
- Long sessions keep the CPU and Wi-Fi awake on both sides; expect battery drain similar
  to music streaming. Plugging the host in for a whole movie is a good idea.
- Clients must be Android phones too (Android 10+); there is no iOS/desktop client.
