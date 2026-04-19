# Anti-YouTube

A self-binding YouTube blocker for **Windows** and **Linux**. Once started, you can't quit it from the app itself — only by killing the process. You get a daily 30-minute break budget that can be split into as many sessions as you like.

YouTube Music (`music.youtube.com`) is deliberately left reachable so you can still play background music.

## How it works

The app edits the system `hosts` file to point YouTube's hostnames at `0.0.0.0`:

- `youtube.com`
- `www.youtube.com`
- `m.youtube.com`
- `youtu.be`
- `www.youtu.be`

The `hosts` file is consulted before any DNS query is sent, so this works regardless of which DNS server you're using (router, home server, public resolver, etc.). `music.youtube.com` is a separate hostname and isn't touched, so YouTube Music keeps working.

Editing `hosts` requires administrator rights, so the app self-elevates on launch (UAC on Windows, `pkexec`/`sudo` on Linux).

## Usage

### Start

- **Windows:** double-click `anti-youtube.exe`. Accept the UAC prompt.
- **Linux:** run `./anti-youtube` from a terminal, or launch from your desktop environment. You'll be prompted for your password (via `pkexec` if installed, otherwise `sudo`).

A red dot appears in the system tray — you're blocked.

### Toggle a break

- **Global hotkey:** `Ctrl + Alt + Shift + Y` (works from anywhere, no need to focus the app).
- **Tray icon:** left-click, or right-click → `Start break` / `End break`.

The icon turns green while on break. The tray tooltip and right-click menu show how much break time you have left for the day.

### Break budget

- **30 minutes per day total.** Splittable however you like — one session, two 15-minute blocks, five 6-minute blocks, whatever.
- Resets at local midnight.
- When the budget hits zero mid-break, the block automatically comes back.
- If you kill the app while on break, the time you were on break is charged on next launch (so force-quitting doesn't give you free break time).

### Stopping the app

There is **no quit / exit menu item** by design. The only way to stop it is to kill the process:

**Windows:**
1. Open Task Manager (`Ctrl + Shift + Esc`) **as Administrator**.
2. Find **Anti-YouTube** in the *Processes* tab, or `anti-youtube.exe` in the *Details* tab.
3. End task.

**Linux:**
```bash
sudo pkill -f anti-youtube
```

Killing the app leaves the current block state in place — if you kill it while blocked, YouTube stays blocked until you either relaunch and take a break, or manually edit `hosts`.

## Known limitations

1. **Browser DNS cache lag.** When a break ends, browsers keep their own DNS cache (~60 seconds) and reuse already-open HTTP/2 connections. YouTube may keep loading for up to a minute after the block is restored. Workarounds:
   - Close the YouTube tab before the break ends.
   - Chrome/Edge: visit `chrome://net-internals/#dns` → *Clear host cache*, then `chrome://net-internals/#sockets` → *Flush socket pools*.
   - Firefox: `about:networking#dns` → *Clear DNS Cache*.
   - Or restart the browser.

2. **DNS-over-HTTPS (DoH) bypass.** If your browser has DoH enabled (some have it on by default), it resolves hostnames over HTTPS and ignores the `hosts` file entirely. The app intentionally does **not** change any system settings to compensate. If YouTube still loads when it shouldn't, check your browser's DoH / "Secure DNS" setting and turn it off. (Chrome: *Settings → Privacy and security → Security → Use secure DNS*.)

3. **Not truly unkillable.** Any admin/root user (including you) can kill the process and then manually edit `hosts` to remove the block. The app is a commitment device, not a security boundary.

4. **Linux tray icon on GNOME.** GNOME Shell removed tray-icon support upstream. If the icon doesn't appear, install the [AppIndicator and KStatusNotifierItem Support](https://extensions.gnome.org/extension/615/appindicator-support/) extension. KDE, XFCE, Cinnamon, MATE etc. work out of the box.

5. **Linux Wayland hotkey.** The global hotkey is captured by reading `/dev/input/event*` (which requires root — we already have that). This bypasses the display server so it works on both X11 and Wayland.

## Files

```
anti-youtube/
  anti_youtube.py       Source (cross-platform)
  requirements.txt      Python dependencies
  anti-youtube.spec     PyInstaller spec (Windows build config)
  version_info.txt      PE version metadata (Windows only)
  anti-youtube.exe      Built launcher — Windows (not committed)
  anti-youtube          Built launcher — Linux (not committed)
  venv/                 Virtual environment used for builds (not committed)
  README.md             This file
```

At runtime, state lives separately from the install directory:

- **Windows:** `state.bin` next to `anti-youtube.exe`, encrypted with **DPAPI** (tied to your Windows user).
- **Linux:** `/var/lib/anti-youtube/state.bin`, encrypted with **Fernet** using a key at `/var/lib/anti-youtube/.key` (both root-only, mode `0600`).

The state stores the current date, how many break-seconds have been used today, and whether a break is running. Encryption is tamper-*resistance*, not tamper-*proofness* — a determined you could still decrypt and edit it, but that's well past the "open in a text editor" threshold.

## Building

Requirements: Python 3.11+ (3.13 recommended).

### Windows

```bat
cd anti-youtube
py -3.13 -m venv venv
venv\Scripts\python.exe -m pip install --upgrade pip
venv\Scripts\python.exe -m pip install -r requirements.txt
venv\Scripts\python.exe -m PyInstaller --noconfirm anti-youtube.spec
copy /Y dist\anti-youtube.exe .\anti-youtube.exe
```

If `anti-youtube.spec` is missing, regenerate from scratch:

```bat
venv\Scripts\python.exe -m PyInstaller --noconfirm --onefile --windowed ^
  --name anti-youtube ^
  --version-file version_info.txt ^
  --hidden-import keyboard ^
  --hidden-import pystray._win32 ^
  anti_youtube.py
```

### Linux

System prerequisites (Debian/Ubuntu example):

```bash
sudo apt install python3 python3-venv python3-dev \
                 gir1.2-ayatanaappindicator3-0.1 \
                 libcairo2-dev libgirepository1.0-dev
```

`gir1.2-ayatanaappindicator3-0.1` provides the tray backend pystray uses. On Fedora/Arch the package names differ (`libayatana-appindicator-gtk3` / `libayatana-appindicator`).

Then build:

```bash
cd anti-youtube
python3 -m venv venv
venv/bin/pip install --upgrade pip
venv/bin/pip install -r requirements.txt
venv/bin/pyinstaller --noconfirm --onefile \
  --name anti-youtube \
  --hidden-import keyboard \
  anti_youtube.py
cp dist/anti-youtube ./anti-youtube
```

Run with `./anti-youtube` — it'll prompt for elevation via `pkexec` or `sudo`.

## Configuration

All tunables are constants at the top of `anti_youtube.py`:

- `DAILY_BREAK_SECONDS` — default `30 * 60`. Change the daily budget.
- `HOTKEY` — default `"ctrl+alt+shift+y"`. Uses the [`keyboard` library's syntax](https://github.com/boppreh/keyboard#keyboard.add_hotkey).
- `BLOCKED_HOSTS` — hostnames written to the `hosts` file. `music.youtube.com` is deliberately absent.

After editing, rebuild (see above).

## Uninstall

**Windows:**
1. Kill `anti-youtube.exe` from Task Manager (as admin).
2. Open `C:\Windows\System32\drivers\etc\hosts` in an admin editor and remove lines between `# anti-youtube start` and `# anti-youtube end`.
3. Delete the `anti-youtube` folder.

**Linux:**
```bash
sudo pkill -f anti-youtube
sudo sed -i '/# anti-youtube start/,/# anti-youtube end/d' /etc/hosts
sudo rm -rf /var/lib/anti-youtube
rm -rf /path/to/anti-youtube
```
