# Anti-YouTube

A self-binding YouTube blocker for Windows. Once started, you can't quit it from the app itself — only via Task Manager. You get a daily 30-minute break budget that can be split into as many sessions as you like.

YouTube Music (`music.youtube.com`) is deliberately left reachable so you can still play background music.

## How it works

The app edits the Windows `hosts` file to point YouTube's hostnames at `0.0.0.0`:

- `youtube.com`
- `www.youtube.com`
- `m.youtube.com`
- `youtu.be`
- `www.youtu.be`

Because the `hosts` file is consulted before any DNS query is sent, this works regardless of whether you're using your router's DNS, a home-server DNS, or anything else. `music.youtube.com` is a separate hostname and is not touched, so YouTube Music keeps working.

Because the `hosts` file lives under `C:\Windows\System32\drivers\etc\`, editing it requires administrator rights. The app self-elevates on launch (you'll see a UAC prompt).

## Usage

### Start

Double-click **`anti-youtube.exe`**. Accept the UAC prompt. A red dot appears in the system tray — you're now blocked.

### Toggle a break

- **Global hotkey:** `Ctrl + Alt + Shift + Y` (works from anywhere, no need to focus the app).
- **Tray icon:** left-click, or right-click → `Start break` / `End break`.

The icon turns green while on break. The tray tooltip and right-click menu show how much break time you have left for the day.

### Break budget

- **30 minutes per day total.** Splittable however you like — one session, two 15-minute blocks, five 6-minute blocks, whatever.
- Resets at local midnight.
- When the budget hits zero mid-break, the block automatically comes back.
- If you kill the app via Task Manager while on break, the time you were on break is charged on next launch (so force-quitting doesn't give you free break time).

### Stopping the app

There is **no quit / exit menu item** by design. The only way to stop it is Task Manager:

1. Open Task Manager (`Ctrl + Shift + Esc`) **as Administrator** (because the app is elevated, a non-elevated Task Manager can't kill it).
2. Find **Anti-YouTube** in the **Processes** tab, or `anti-youtube.exe` in the **Details** tab.
3. End task.

Killing the app leaves the current block state in place — if you kill it while blocked, YouTube stays blocked (the hosts entries remain until you either relaunch and take a break, or manually edit `hosts`).

## Known limitations

1. **Browser DNS cache lag.** When a break ends, browsers keep their own DNS cache (~60 seconds) and reuse already-open HTTP/2 connections. YouTube may keep loading for up to a minute after the block is restored. Workarounds:
   - Close the YouTube tab before the break ends.
   - Chrome/Edge: visit `chrome://net-internals/#dns` → *Clear host cache*, then `chrome://net-internals/#sockets` → *Flush socket pools*.
   - Firefox: `about:networking#dns` → *Clear DNS Cache*.
   - Or restart the browser.

2. **DNS-over-HTTPS (DoH) bypass.** If your browser has DoH enabled (some have it on by default), it resolves hostnames over HTTPS and ignores the `hosts` file entirely. The app intentionally does **not** change any system settings to compensate. If YouTube still loads when it shouldn't, check your browser's DoH / "Secure DNS" setting and turn it off. (Chrome: *Settings → Privacy and security → Security → Use secure DNS*.)

3. **Not truly unkillable.** Any admin user (including you) can kill `anti-youtube.exe` from an elevated Task Manager and then manually edit the `hosts` file to remove the block. The app is a commitment device, not a security boundary.

4. **Windows-only.** Relies on DPAPI, the Windows `hosts` file path, and the `ipconfig /flushdns` command.

## Files

```
anti-youtube/
  anti-youtube.exe      Built launcher (what you run)
  anti_youtube.py       Source
  anti-youtube.spec     PyInstaller spec (used for rebuilds)
  version_info.txt      PE version metadata embedded into the exe
  state.bin             Encrypted break-budget state (DPAPI)
  venv/                 Python virtual environment used for builds
  README.md             This file
```

### `state.bin`

Stores the current date, how many break-seconds have been used today, and whether a break is currently running. Encrypted with **Windows DPAPI** using your Windows user credentials — so it's opaque binary, and copying it to another user or machine makes it unreadable. This is tamper-*resistance*, not tamper-*proofness*: a determined you could still write code to decrypt and edit it, but it's well past the "open a JSON file in Notepad" threshold.

## Building

Requirements: Python 3.13 (the `py` launcher is enough — no need for `python.exe` on PATH).

### First-time setup

```bat
cd anti-youtube
py -3.13 -m venv venv
venv\Scripts\python.exe -m pip install --upgrade pip
venv\Scripts\python.exe -m pip install pystray pillow keyboard pyinstaller
```

### Rebuild the exe after editing `anti_youtube.py`

```bat
venv\Scripts\python.exe -m PyInstaller --noconfirm anti-youtube.spec
copy /Y dist\anti-youtube.exe .\anti-youtube.exe
```

The `.spec` file remembers the build flags (onefile, windowed, version metadata, hidden imports), so you don't need to repeat them.

### Full rebuild from scratch (if the spec file is lost)

```bat
venv\Scripts\python.exe -m PyInstaller --noconfirm --onefile --windowed ^
  --name anti-youtube ^
  --version-file version_info.txt ^
  --hidden-import keyboard ^
  --hidden-import pystray._win32 ^
  anti_youtube.py
copy /Y dist\anti-youtube.exe .\anti-youtube.exe
```

## Configuration

All tunables are constants at the top of `anti_youtube.py`:

- `DAILY_BREAK_SECONDS` — default `30 * 60`. Change the daily budget.
- `HOTKEY` — default `"ctrl+alt+shift+y"`. Uses the [`keyboard` library's syntax](https://github.com/boppreh/keyboard#keyboard.add_hotkey).
- `BLOCKED_HOSTS` — hostnames written to the `hosts` file. `music.youtube.com` is deliberately absent.

After editing, rebuild the exe (see above).

## Uninstall

1. Kill `anti-youtube.exe` from Task Manager (as admin).
2. Open `C:\Windows\System32\drivers\etc\hosts` in an admin editor and remove any lines between `# anti-youtube start` and `# anti-youtube end`.
3. Delete the `anti-youtube` folder.
