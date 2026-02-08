# Wi-Fi Sound Thing

Ionic + Angular + Capacitor app for host/client Wi-Fi audio sharing.

## Modes (Yes, There Are Two)

| Mode | Best for | Requires | Notes |
| --- | --- | --- | --- |
| `Native UDP (Android)` | Highest chance for Spotify/Crunchyroll scenarios | Android app build | Tries playback capture first, then microphone fallback when blocked/silent. |
| `WebRTC + signaling` | Browser testing and simpler LAN demos | Signaling server (`npm run signal`) | Better for desktop/web workflows, not best for protected app audio. |

Use `Native UDP` if your goal is real device-to-device listening from apps like Spotify/Crunchyroll.

## Prerequisites

- Node.js 20+
- npm 10+
- Java 21 for Android builds (example: `C:\Users\Dominik\.jdks\ms-21.0.8`)

## Setup

```bash
npm install
npx cap sync
```

## How To Run

### 1) Web UI (dev)

```bash
npm run start
```

Open `http://localhost:4200`.

### 2) WebRTC signaling server (only for WebRTC mode)

```bash
npm run signal
```

Default signaling endpoint is `ws://0.0.0.0:8787`.

### 3) Android app (required for Native UDP mode)

```bash
npm run android:studio
```

Then run from Android Studio on physical devices.

Optional Java compile check (from `android/`):

```powershell
$env:JAVA_HOME='C:\Users\Dominik\.jdks\ms-21.0.8'
$env:Path="$env:JAVA_HOME\bin;" + $env:Path
.\gradlew.bat :app:compileDebugJavaWithJavac
```

## How To Use

### Native UDP mode (recommended)

1. Run the app on Android host and Android client device(s).
2. Host device:
   - Role: `Host`
   - Transport: `Native UDP`
   - Capture source: `Auto (playback capture, mic fallback)`
   - Enter client IPs in `Target peers`
   - Start broadcast
3. Client device:
   - Role: `Client`
   - Transport: `Native UDP`
   - Enter host IP and same UDP port
   - Connect

### WebRTC mode

1. Start `npm run signal`.
2. Open app on host and client.
3. Host:
   - Transport: `WebRTC`
   - Set signaling URL (for example `ws://<host-ip>:8787`)
   - Start broadcast
4. Client:
   - Transport: `WebRTC`
   - Keep discovery enabled or select host manually
   - Connect

## Helpful Commands

- `npm run lint`
- `npm run build`
- `npm test -- --watch=false --browsers=ChromeHeadless`
- `cd android && .\gradlew.bat :app:testDebugUnitTest`

## Reality Check

- True zero-delay dual-Bluetooth from one phone is still mostly vendor/OS/hardware dependent.
- Playback capture can be blocked by app/DRM policy.
- Native auto mode falls back to microphone when playback capture is denied or stays silent.

## Project Layout

- `android/app/src/main/java/com/wifisound/ui/audio/` - native plugin + host/client services + packet codec.
- `src/app/shared/services/native-udp-audio.service.ts` - TypeScript bridge for native plugin.
- `src/app/shared/services/realtime-audio.service.ts` - WebRTC runtime.
- `src/app/shared/services/host-discovery.service.ts` - discovery adapter.
- `tools/signaling-server.mjs` - signaling server for WebRTC mode.
