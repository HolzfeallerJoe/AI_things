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
- **Tray icon:** left-click (fires the default action = toggle break), or right-click for the full menu.

The icon turns green while on break, red while blocked. The tooltip shows current status + remaining daily budget.

### Tray menu

Right-click the tray icon to see:

| Item | What it does |
|---|---|
| **Start break** / **End break** | Toggle the break. Default item — a left-click triggers this too. |
| **Flush browser DNS cache** | Detects your default browser (Chrome, Edge, Firefox, Brave, Opera, Vivaldi) and opens its DNS-flush page directly. Use this right after ending a break if a YouTube tab is still loading. |
| *Status line* (disabled) | "BLOCKED — MM:SS break left" or "BREAK — MM:SS left today". |
| *Hotkey line* (disabled) | Reminder of the configured shortcut. |

No "Quit" / "Exit" item — by design. See [Stopping the app](#stopping-the-app).

### Break-end notification

When a break ends (either because you toggled it off or the budget ran out), Anti-YouTube posts a Windows toast:

> **Anti-YouTube: break ended**
> YouTube is blocked again. Click to flush browser DNS cache.
> [ Flush DNS cache ]

- **Windows:** clicking the toast body or the **Flush DNS cache** action button triggers the same flow as the tray menu item. Clicks are routed through a private `anti-youtube://flush` URL scheme (registered in `HKCU\Software\Classes\anti-youtube` on first launch), which avoids depending on the browser's own scheme (e.g. `brave://`, `opera://`) being registered system-wide.
- **Linux:** the notification is posted via `notify-send --wait` with an action button. Clicking it — or (on KDE and some other daemons) the notification body — fires the flush. The notification auto-expires after 30 seconds, which also frees the waiting `notify-send` subprocess. GNOME shows the button; clicking the body just dismisses.

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

1. **Browser DNS cache lag.** When a break ends, browsers keep their own DNS cache (~60 seconds) and reuse already-open HTTP/2 connections. YouTube may keep loading for up to a minute after the block is restored. The app can't clear the browser's internal cache from outside — so it gives you a one-click shortcut instead (break-end toast → *Flush DNS cache*, or the tray menu item). That opens your browser's internal DNS-flush page. On that page, click *Clear host cache* and — on Chromium browsers — *Flush socket pools* under the `#sockets` tab. Or just close the YouTube tab before the break ends.

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
  uninstall.bat         One-click uninstaller — Windows
  venv/                 Virtual environment used for builds (not committed)
  README.md             This file
```

## What the app touches on your system

| Path / key | Purpose | Reverted by `--uninstall` |
|---|---|---|
| `C:\Windows\System32\drivers\etc\hosts` (Win) / `/etc/hosts` (Linux) | Block lines between `# anti-youtube start` / `# anti-youtube end` markers | Yes |
| `state.bin` next to the exe (Win) | Encrypted break-budget state (DPAPI, per-user) | Yes |
| `/var/lib/anti-youtube/` (Linux) | State + Fernet key, mode `0700` / `0600` | Yes (directory removed) |
| `HKCU\Software\Classes\anti-youtube` (Win) | Registers the `anti-youtube://` URL scheme so toast clicks route through the app | Yes |

Nothing else is changed. DNS / DoH settings, firewall rules, startup entries, browser profiles — all untouched.

The state file records the current date, break-seconds used today, and whether a break is currently running. Encryption is tamper-*resistance*, not tamper-*proofness* — a determined you could still decrypt and edit it, but that's well past the "open in a text editor" threshold.

## Building

Requirements: Python 3.11+ (3.13 recommended). All Python deps are in `requirements.txt`:

| Package | Purpose | Platform |
|---|---|---|
| `pystray` + `pillow` | Tray icon and menu | all |
| `keyboard` | Global hotkey | all |
| `winotify` | Rich Windows 10/11 toast with action button | Windows |
| `cryptography` | Fernet state encryption | Linux |
| `pyinstaller` | Build the single-file exe/binary | all |

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
  --hidden-import winotify ^
  anti_youtube.py
```

### Linux

System prerequisites (Debian/Ubuntu example):

```bash
sudo apt install python3 python3-venv python3-dev \
                 gir1.2-ayatanaappindicator3-0.1 \
                 libcairo2-dev libgirepository1.0-dev \
                 libnotify-bin xdg-utils
```

`gir1.2-ayatanaappindicator3-0.1` provides the tray backend pystray uses. `libnotify-bin` provides `notify-send` (for the break-end toast with the "Flush DNS cache" button). `xdg-utils` provides `xdg-settings`, used for default-browser detection. On Fedora/Arch the package names differ (`libayatana-appindicator-gtk3` / `libayatana-appindicator`, `libnotify`, `xdg-utils`).

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
- `FLUSH_URL_BY_BROWSER` / `FLUSH_URL_DEFAULT` — per-browser URL opened by the "Flush browser DNS cache" menu item.

After editing, rebuild (see above).

## CLI flags

| Invocation | What it does |
|---|---|
| `anti-youtube.exe` | Normal startup: elevate, apply block, register URL scheme (Win), run tray. |
| `anti-youtube.exe --flush` | Opens the detected browser's DNS-flush page and exits. No elevation needed; no tray icon; no effect on the running instance. Handy as a keyboard-shortcut or desktop-shortcut target. |
| `anti-youtube.exe --uninstall` | Self-elevates, reverts every system change, exits. Does not delete the install folder. |
| `anti-youtube.exe anti-youtube://flush` | Internal. Same as `--flush`, but invoked through the registered URL scheme when you click a toast. |

On Linux the same flags apply (`./anti-youtube --flush`, `./anti-youtube --uninstall`); `anti-youtube://...` is Windows-specific.

## Uninstall

**Windows:** double-click **`uninstall.bat`**. It will:
- kill any running `anti-youtube.exe`
- remove the YouTube block from `hosts` (single UAC prompt)
- delete `state.bin`
- delete the `HKCU\Software\Classes\anti-youtube` registry entry
- delete the entire folder

Alternative (manual): run `anti-youtube.exe --uninstall` yourself (does everything except the folder delete), then delete the folder.

**Linux:**
```bash
sudo ./anti-youtube --uninstall
# then
rm -rf /path/to/anti-youtube
```
`--uninstall` removes the hosts entry, `/var/lib/anti-youtube/` (state + key), and flushes DNS. It does not delete the install folder.
