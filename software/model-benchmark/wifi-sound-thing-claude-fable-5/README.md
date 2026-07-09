# WiFi Sound Thing

**What it is:** An Android app that lets one phone (the *Host*) share whatever sound it is
playing — music, videos, games, browser audio — with other phones (*Clients*) over the local
Wi-Fi network in real time. Each client hears the host's audio through its own speaker or
Bluetooth headphones. Two people can watch a movie on one phone, each with their own
headphones. Everything stays on your local network; no internet service is involved.

---

## Prerequisites

Everything needed is free:

| Tool | Version | Where to get it |
| --- | --- | --- |
| Android Studio (includes the Android SDK and a suitable Java) | Ladybug (2024.2) or newer | <https://developer.android.com/studio> (free) |
| Android SDK Platform 35 + Build Tools | installed via Android Studio's SDK Manager | bundled with Android Studio |
| JDK | 17 or newer (Android Studio ships one — no separate install needed) | bundled with Android Studio |
| Two Android phones | Android 10 (API 29) or newer | — |

You do **not** need to install Gradle — the project ships with the Gradle wrapper, which
downloads the right version automatically on first build (internet required once).

Command-line only (without Android Studio) also works: install a JDK 17+ and the Android
SDK command-line tools, set `ANDROID_HOME`, and accept the licenses with
`sdkmanager --licenses`.

## Build instructions

From a fresh checkout, in the project root (`wifi-sound-thing-<model>`):

**Windows**
```bat
gradlew.bat assembleDebug
```

**macOS / Linux**
```sh
./gradlew assembleDebug
```

The installable app is produced at:

```
app/build/outputs/apk/debug/app-debug.apk
```

The first build downloads Gradle and dependencies and can take several minutes.
If the build cannot find your SDK, create a `local.properties` file in the project root
containing (adjust the path): `sdk.dir=C:\\Users\\<you>\\AppData\\Local\\Android\\Sdk`

### Installing on a phone

Option A — with a USB cable and [adb](https://developer.android.com/tools/adb)
(included in the SDK's `platform-tools`; enable *Developer options → USB debugging*
on the phone first):

```sh
adb install app/build/outputs/apk/debug/app-debug.apk
```

Or build + install in one step with the phone connected: `gradlew.bat installDebug`

Option B — without a cable: copy `app-debug.apk` onto the phone (email it to yourself,
or use Google Drive / a USB file transfer), tap the file on the phone, and allow
"install from unknown sources" when Android asks.

Install the app on **both** phones (the same APK is used for host and client).

### Running the automated tests

```bat
gradlew.bat testDebugUnitTest
```

## Usage guide

Both phones must be connected to the **same Wi-Fi network** (or one phone's hotspot with
the other phone connected to it).

### On the host phone (the one playing the movie/music)

1. Open **WiFi Sound Thing** and tap **Host**.
2. Tap **Start broadcasting**.
3. The first time, Android asks for two permissions:
   - **Microphone** — required by Android for any audio capture. The app does *not*
     record the actual microphone, only the phone's media sound.
   - **Screen recording / casting** ("Start recording or casting?") — this is Android's
     standard prompt for capturing media sound. Choose **the entire screen** and confirm.
     Only the *sound* is captured; the screen image is never recorded or sent anywhere.
4. The status changes to **Broadcasting** and the phone's address is shown
   (e.g. `192.168.1.23:46464`).
5. Switch to your video or music app and press play. You can turn the screen off —
   broadcasting continues (a notification with a Stop button stays visible).

### On each client phone (the ones listening)

1. Connect your Bluetooth headphones to the client phone as usual (or just use its speaker).
2. Open **WiFi Sound Thing** and tap **Client**.
3. Under **Hosts on your network**, the host phone appears automatically after a few
   seconds — tap it.
4. If it does not appear (some routers block discovery), type the address shown on the
   host's screen into **Or connect by address** and tap **Connect**.
5. The status changes to **Playing** and you should hear the host's audio. Playback keeps
   running with the screen off.
6. If the sound stutters, open the **Buffering** setting and pick **Most stable**
   (slightly more delay, fewer dropouts). If the sound lags behind the video, pick
   **Lowest delay**.

To stop: tap **Stop broadcasting** / **Disconnect** in the app, or use the button in the
notification.

### Tips for best results

- Keep both phones reasonably close to the Wi-Fi router, or use the host phone's hotspot.
- On the host, media volume affects the stream on some devices — if listeners hear
  nothing, check that the host's media volume is up.
- Expect a small, constant delay (roughly 0.1–0.3 s depending on the buffering setting).
  For shared movie watching this is normally comfortable; Bluetooth headphones add their
  own small delay on top.

## Known limitations

- **Which apps can be captured (FR-4):** Android only lets apps capture the sound of apps
  that allow it. In practice:
  - ✅ **Works:** Spotify, YouTube, Chrome/Firefox and other browsers, most music players,
    most games, podcasts, locally stored videos, and most apps that don't set a
    capture-block flag. Crunchyroll is reported to work, but this can change with app
    updates.
  - ❌ **Does not work:** apps that explicitly block audio capture — most notably
    **Netflix**, and some other DRM-heavy video apps (e.g. Disney+, Amazon Prime Video on
    many devices). These play normally on the host but are **silent** for listeners.
    This is enforced by Android itself; no app can work around it.
  - Phone calls, VoIP calls, and notification sounds are not captured (only media/game
    audio streams are).
- Requires Android 10 or newer on the host (the system audio-capture API does not exist
  before that) and on clients (app minimum).
- Host and clients must be on the same network. Networks with "client isolation"
  (common on public/guest Wi-Fi) block phone-to-phone traffic entirely — use a hotspot
  instead.
- Automatic discovery (mDNS) is blocked by some routers; manual address entry is the
  fallback.
- The delay is small but not zero. The *host's* own audio is perfectly synced with its
  video; *clients* hear the sound slightly later. Watching the video on the host phone
  together while listening on clients works well; showing the video on a second screen
  while listening through this app will be noticeably out of sync.
- Audio is sent unencrypted on your local network (it never leaves the LAN). Anyone on
  the same network could technically listen in; don't use it on untrusted networks for
  private audio.
- iOS clients are not supported (Android only, per requirements scope).
