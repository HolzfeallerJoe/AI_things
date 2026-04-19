"""Anti-YouTube: hosts-file based YouTube blocker with a daily break budget.

Supports Windows and Linux. Blocks youtube.com / www.youtube.com /
m.youtube.com / youtu.be via the system hosts file. Leaves
music.youtube.com untouched so YouTube Music keeps working. Daily
30-minute break budget that can be split however you like. Toggle
break with Ctrl+Alt+Shift+Y or the tray icon.
"""

import datetime
import json
import os
import shutil
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path

from PIL import Image, ImageDraw
import keyboard
import pystray


IS_WINDOWS = sys.platform == "win32"
IS_LINUX = sys.platform.startswith("linux")

if not (IS_WINDOWS or IS_LINUX):
    raise SystemExit("Anti-YouTube supports Windows and Linux only.")


MARKER_START = "# anti-youtube start"
MARKER_END = "# anti-youtube end"
DAILY_BREAK_SECONDS = 30 * 60
HOTKEY = "ctrl+alt+shift+y"

BLOCKED_HOSTS = [
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
    "www.youtu.be",
]

FLUSH_URL_BY_BROWSER = {
    "chrome": "chrome://net-internals/#dns",
    "msedge": "edge://net-internals/#dns",
    "edge": "edge://net-internals/#dns",
    "firefox": "about:networking#dns",
    "brave": "brave://net-internals/#dns",
    "opera": "opera://net-internals/#dns",
    "vivaldi": "vivaldi://net-internals/#dns",
}
FLUSH_URL_DEFAULT = "chrome://net-internals/#dns"

if IS_WINDOWS:
    import ctypes
    import ctypes.wintypes as wintypes

    HOSTS_PATH = Path(r"C:\Windows\System32\drivers\etc\hosts")
else:
    HOSTS_PATH = Path("/etc/hosts")


_STATE_DIR: Path | None = None


def state_dir() -> Path:
    global _STATE_DIR
    if _STATE_DIR is not None:
        return _STATE_DIR
    if IS_WINDOWS:
        if getattr(sys, "frozen", False):
            _STATE_DIR = Path(sys.executable).parent
        else:
            _STATE_DIR = Path(__file__).parent
    else:
        _STATE_DIR = Path("/var/lib/anti-youtube")
        _STATE_DIR.mkdir(parents=True, exist_ok=True)
        os.chmod(_STATE_DIR, 0o700)
    return _STATE_DIR


def state_file() -> Path:
    return state_dir() / "state.bin"


def legacy_state_file() -> Path:
    return state_dir() / "state.json"


# ---------- Admin / elevation ----------

def is_admin() -> bool:
    if IS_WINDOWS:
        try:
            return ctypes.windll.shell32.IsUserAnAdmin() != 0
        except Exception:
            return False
    return os.geteuid() == 0


def elevate() -> None:
    if IS_WINDOWS:
        params = " ".join(f'"{a}"' for a in sys.argv)
        ctypes.windll.shell32.ShellExecuteW(
            None, "runas", sys.executable, params, None, 1
        )
        sys.exit(0)
    for cmd in ("pkexec", "sudo"):
        path = shutil.which(cmd)
        if path:
            os.execvp(path, [cmd, sys.executable, *sys.argv[1:]])
    print(
        "Anti-YouTube needs root. Install pkexec or run with sudo.",
        file=sys.stderr,
    )
    sys.exit(1)


# ---------- State encryption ----------

if IS_WINDOWS:
    class _DataBlob(ctypes.Structure):
        _fields_ = [
            ("cbData", wintypes.DWORD),
            ("pbData", ctypes.POINTER(ctypes.c_ubyte)),
        ]

    _crypt32 = ctypes.windll.crypt32
    _kernel32 = ctypes.windll.kernel32

    def _to_blob(data: bytes) -> _DataBlob:
        buf = (ctypes.c_ubyte * len(data)).from_buffer_copy(data)
        return _DataBlob(len(data), ctypes.cast(buf, ctypes.POINTER(ctypes.c_ubyte)))

    def _blob_to_bytes(blob: _DataBlob) -> bytes:
        try:
            return ctypes.string_at(blob.pbData, blob.cbData)
        finally:
            _kernel32.LocalFree(blob.pbData)

    def encrypt_state(data: bytes) -> bytes:
        in_blob = _to_blob(data)
        out_blob = _DataBlob()
        if not _crypt32.CryptProtectData(
            ctypes.byref(in_blob), None, None, None, None, 0, ctypes.byref(out_blob)
        ):
            raise OSError("CryptProtectData failed")
        return _blob_to_bytes(out_blob)

    def decrypt_state(data: bytes) -> bytes:
        in_blob = _to_blob(data)
        out_blob = _DataBlob()
        if not _crypt32.CryptUnprotectData(
            ctypes.byref(in_blob), None, None, None, None, 0, ctypes.byref(out_blob)
        ):
            raise OSError("CryptUnprotectData failed")
        return _blob_to_bytes(out_blob)

else:
    from cryptography.fernet import Fernet

    def _get_key() -> bytes:
        key_path = state_dir() / ".key"
        if key_path.exists():
            return key_path.read_bytes()
        key = Fernet.generate_key()
        key_path.write_bytes(key)
        os.chmod(key_path, 0o600)
        return key

    def encrypt_state(data: bytes) -> bytes:
        return Fernet(_get_key()).encrypt(data)

    def decrypt_state(data: bytes) -> bytes:
        return Fernet(_get_key()).decrypt(data)


# ---------- State ----------

def today_str() -> str:
    return datetime.date.today().isoformat()


def default_state() -> dict:
    return {
        "date": today_str(),
        "break_seconds_used": 0.0,
        "on_break": False,
        "break_started_at": None,
    }


def load_state() -> dict:
    raw = None
    sf = state_file()
    legacy = legacy_state_file()
    if sf.exists():
        try:
            raw = decrypt_state(sf.read_bytes()).decode("utf-8")
        except Exception:
            raw = None
    elif legacy.exists():
        try:
            raw = legacy.read_text(encoding="utf-8")
        except Exception:
            raw = None
        try:
            legacy.unlink()
        except Exception:
            pass
    if raw:
        try:
            s = json.loads(raw)
            if s.get("date") != today_str():
                return default_state()
            return s
        except Exception:
            pass
    return default_state()


def save_state(s: dict) -> None:
    payload = json.dumps(s).encode("utf-8")
    sf = state_file()
    sf.write_bytes(encrypt_state(payload))
    if not IS_WINDOWS:
        try:
            os.chmod(sf, 0o600)
        except Exception:
            pass


# ---------- Hosts file ----------

def _strip_block(text: str) -> str:
    out, skipping = [], False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped == MARKER_START:
            skipping = True
            continue
        if stripped == MARKER_END:
            skipping = False
            continue
        if not skipping:
            out.append(line)
    return "\n".join(out).rstrip() + "\n"


def apply_block() -> None:
    original = HOSTS_PATH.read_text(encoding="utf-8")
    base = _strip_block(original)
    block = [MARKER_START] + [f"0.0.0.0 {h}" for h in BLOCKED_HOSTS] + [MARKER_END]
    new_text = base.rstrip() + "\n\n" + "\n".join(block) + "\n"
    if new_text != original:
        HOSTS_PATH.write_text(new_text, encoding="utf-8")
    _flush_dns()


def remove_block() -> None:
    original = HOSTS_PATH.read_text(encoding="utf-8")
    stripped = _strip_block(original)
    if stripped != original:
        HOSTS_PATH.write_text(stripped, encoding="utf-8")
    _flush_dns()


def _run_quiet(cmd: list[str]) -> None:
    try:
        kwargs: dict = {"capture_output": True, "timeout": 5}
        if IS_WINDOWS:
            kwargs["creationflags"] = 0x08000000  # CREATE_NO_WINDOW
        subprocess.run(cmd, **kwargs)
    except Exception:
        pass


def _flush_dns() -> None:
    if IS_WINDOWS:
        _run_quiet(["ipconfig", "/flushdns"])
        return
    for cmd in (
        ["resolvectl", "flush-caches"],
        ["systemd-resolve", "--flush-caches"],
        ["nscd", "-i", "hosts"],
    ):
        if shutil.which(cmd[0]):
            _run_quiet(cmd)


# ---------- Break state machine ----------

state_lock = threading.Lock()
state: dict = default_state()
icon: pystray.Icon | None = None


def _remaining_locked() -> float:
    used = state["break_seconds_used"]
    if state["on_break"] and state["break_started_at"]:
        used += time.time() - state["break_started_at"]
    return max(0.0, DAILY_BREAK_SECONDS - used)


def remaining_break_seconds() -> float:
    with state_lock:
        return _remaining_locked()


def format_mmss(sec: float) -> str:
    sec = int(sec)
    return f"{sec // 60:02d}:{sec % 60:02d}"


def start_break() -> None:
    with state_lock:
        if state["on_break"]:
            return
        if _remaining_locked() <= 0:
            return
        state["on_break"] = True
        state["break_started_at"] = time.time()
        save_state(state)
    remove_block()
    _refresh_icon()


def end_break() -> None:
    with state_lock:
        if not state["on_break"]:
            return
        if state["break_started_at"]:
            state["break_seconds_used"] += time.time() - state["break_started_at"]
        state["on_break"] = False
        state["break_started_at"] = None
        save_state(state)
    apply_block()
    _refresh_icon()
    _notify_block_restored()


def _delete_reg_key_tree(hive: int, path: str) -> None:
    import winreg

    try:
        with winreg.OpenKey(hive, path, 0, winreg.KEY_ALL_ACCESS) as key:
            while True:
                try:
                    sub = winreg.EnumKey(key, 0)
                except OSError:
                    break
                _delete_reg_key_tree(hive, f"{path}\\{sub}")
        winreg.DeleteKey(hive, path)
    except OSError:
        pass


def uninstall() -> None:
    """Remove the hosts entry, state file, and registered URL protocol."""
    try:
        original = HOSTS_PATH.read_text(encoding="utf-8")
        stripped = _strip_block(original)
        if stripped != original:
            HOSTS_PATH.write_text(stripped, encoding="utf-8")
        _flush_dns()
    except Exception:
        pass

    for f in (state_file(), legacy_state_file()):
        try:
            f.unlink(missing_ok=True)
        except Exception:
            pass

    if IS_LINUX:
        try:
            (state_dir() / ".key").unlink(missing_ok=True)
            state_dir().rmdir()
        except Exception:
            pass

    if IS_WINDOWS:
        import winreg

        _delete_reg_key_tree(
            winreg.HKEY_CURRENT_USER, r"Software\Classes\anti-youtube"
        )


def _register_url_protocol() -> None:
    """Register anti-youtube:// URL scheme so toast notifications can call back."""
    if not IS_WINDOWS:
        return
    try:
        import winreg

        exe = sys.executable
        with winreg.CreateKey(
            winreg.HKEY_CURRENT_USER, r"Software\Classes\anti-youtube"
        ) as k:
            winreg.SetValue(k, "", winreg.REG_SZ, "URL:Anti-YouTube Protocol")
            winreg.SetValueEx(k, "URL Protocol", 0, winreg.REG_SZ, "")
        with winreg.CreateKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Classes\anti-youtube\shell\open\command",
        ) as k:
            winreg.SetValue(k, "", winreg.REG_SZ, f'"{exe}" "%1"')
    except Exception as e:
        print(f"Protocol registration failed: {e}", file=sys.stderr)


def _detect_default_browser() -> tuple[str, str] | None:
    """Return (browser_exe, flush_url) for the default browser, or None."""
    if not IS_WINDOWS:
        return None
    try:
        import winreg

        with winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice",
        ) as k:
            prog_id = winreg.QueryValueEx(k, "ProgId")[0]
        with winreg.OpenKey(
            winreg.HKEY_CLASSES_ROOT, rf"{prog_id}\shell\open\command"
        ) as k:
            cmd = winreg.QueryValueEx(k, "")[0]
        if cmd.startswith('"'):
            exe = cmd[1 : cmd.index('"', 1)]
        else:
            exe = cmd.split()[0]
        pid = prog_id.lower()
        for key, url in FLUSH_URL_BY_BROWSER.items():
            if key in pid:
                return exe, url
        return exe, FLUSH_URL_DEFAULT
    except Exception:
        return None


def open_flush_page(*_: object) -> None:
    info = _detect_default_browser()
    if info:
        exe, url = info
        try:
            kwargs: dict = {}
            if IS_WINDOWS:
                kwargs["creationflags"] = 0x08000000
            subprocess.Popen([exe, url], **kwargs)
            return
        except Exception:
            pass
    try:
        webbrowser.open(FLUSH_URL_DEFAULT)
    except Exception:
        pass


def _notify_block_restored() -> None:
    if IS_WINDOWS:
        try:
            from winotify import Notification

            # Route clicks through our own URL scheme; _register_url_protocol()
            # set up the handler. This avoids depending on the browser's own
            # scheme (chrome://, brave://, ...) being registered system-wide.
            launch_url = "anti-youtube://flush"
            toast = Notification(
                app_id="Anti-YouTube",
                title="Anti-YouTube: break ended",
                msg="YouTube is blocked again. Click to flush browser DNS cache.",
                launch=launch_url,
            )
            toast.add_actions(label="Flush DNS cache", launch=launch_url)
            toast.show()
            return
        except Exception:
            pass
    if icon is None:
        return
    try:
        icon.notify(
            "YouTube is blocked again. Use the tray menu → Flush browser DNS cache.",
            "Anti-YouTube: break ended",
        )
    except Exception:
        pass


def toggle_break() -> None:
    with state_lock:
        on_break = state["on_break"]
    if on_break:
        end_break()
    else:
        start_break()


# ---------- Tray UI ----------

def _make_icon_image(on_break: bool) -> Image.Image:
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    color = (46, 160, 67) if on_break else (215, 58, 73)
    d.ellipse((6, 6, 58, 58), fill=color)
    d.rectangle((20, 28, 44, 36), fill=(255, 255, 255))
    if not on_break:
        d.rectangle((28, 20, 36, 44), fill=(255, 255, 255))
    return img


def _status_text() -> str:
    with state_lock:
        on_break = state["on_break"]
        remaining = _remaining_locked()
    if on_break:
        return f"BREAK — {format_mmss(remaining)} left today"
    return f"BLOCKED — {format_mmss(remaining)} break left"


def _refresh_icon() -> None:
    if icon is None:
        return
    with state_lock:
        on_break = state["on_break"]
    icon.icon = _make_icon_image(on_break)
    icon.title = f"Anti-YouTube: {_status_text()}"
    try:
        icon.update_menu()
    except Exception:
        pass


def _menu_toggle_label(_item) -> str:
    with state_lock:
        return "End break" if state["on_break"] else "Start break"


def _menu_status_label(_item) -> str:
    return _status_text()


def _menu_hotkey_label(_item) -> str:
    return f"Hotkey: {HOTKEY.replace('+', ' + ').title()}"


def _build_menu() -> pystray.Menu:
    return pystray.Menu(
        pystray.MenuItem(_menu_toggle_label, lambda *_: toggle_break(), default=True),
        pystray.MenuItem("Flush browser DNS cache", open_flush_page),
        pystray.MenuItem(_menu_status_label, None, enabled=False),
        pystray.MenuItem(_menu_hotkey_label, None, enabled=False),
    )


# ---------- Ticker / startup ----------

def ticker() -> None:
    while True:
        time.sleep(1)
        rollover = False
        with state_lock:
            if state["date"] != today_str():
                state["date"] = today_str()
                state["break_seconds_used"] = 0.0
                state["on_break"] = False
                state["break_started_at"] = None
                save_state(state)
                rollover = True
        if rollover:
            apply_block()
        with state_lock:
            expired = state["on_break"] and _remaining_locked() <= 0
        if expired:
            end_break()
        _refresh_icon()


def startup_reconcile() -> None:
    """Charge any break time that was running when the app was killed."""
    with state_lock:
        if state["date"] != today_str():
            state.update(default_state())
        if state["on_break"] and state["break_started_at"]:
            state["break_seconds_used"] += time.time() - state["break_started_at"]
        state["on_break"] = False
        state["break_started_at"] = None
        save_state(state)


def main() -> None:
    global state, icon

    # Protocol handler: fire-and-forget mode triggered by clicking a toast.
    # Runs as a regular (non-elevated) process — just opens the flush page.
    if len(sys.argv) > 1 and sys.argv[1].startswith("anti-youtube:"):
        action = sys.argv[1].split("://", 1)[-1].strip("/").lower()
        if action == "flush":
            open_flush_page()
        return

    if "--uninstall" in sys.argv:
        if not is_admin():
            elevate()
            return
        uninstall()
        return

    if not is_admin():
        elevate()
        return

    _register_url_protocol()
    state = load_state()
    startup_reconcile()
    apply_block()

    try:
        keyboard.add_hotkey(HOTKEY, toggle_break)
    except Exception as e:
        print(f"Failed to register hotkey: {e}", file=sys.stderr)

    threading.Thread(target=ticker, daemon=True).start()

    icon = pystray.Icon(
        "anti-youtube",
        _make_icon_image(False),
        "Anti-YouTube",
        menu=_build_menu(),
    )
    _refresh_icon()
    icon.run()


if __name__ == "__main__":
    main()
