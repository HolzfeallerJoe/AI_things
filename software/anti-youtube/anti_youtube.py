"""Anti-YouTube: hosts-file based YouTube blocker with a daily break budget.

Blocks youtube.com / www.youtube.com / m.youtube.com / youtu.be via the
Windows hosts file. Leaves music.youtube.com untouched so YouTube Music
keeps working. Daily 30-minute break budget that can be split however
you like. Toggle break with Ctrl+Alt+Shift+Y or the tray icon.
"""

import ctypes
import ctypes.wintypes as wintypes
import datetime
import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

from PIL import Image, ImageDraw
import keyboard
import pystray


if getattr(sys, "frozen", False):
    APP_DIR = Path(sys.executable).parent
else:
    APP_DIR = Path(__file__).parent
STATE_FILE = APP_DIR / "state.bin"
LEGACY_STATE_FILE = APP_DIR / "state.json"
HOSTS_PATH = Path(r"C:\Windows\System32\drivers\etc\hosts")
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


class _DataBlob(ctypes.Structure):
    _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_ubyte))]


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


def dpapi_encrypt(data: bytes) -> bytes:
    in_blob = _to_blob(data)
    out_blob = _DataBlob()
    if not _crypt32.CryptProtectData(
        ctypes.byref(in_blob), None, None, None, None, 0, ctypes.byref(out_blob)
    ):
        raise OSError("CryptProtectData failed")
    return _blob_to_bytes(out_blob)


def dpapi_decrypt(data: bytes) -> bytes:
    in_blob = _to_blob(data)
    out_blob = _DataBlob()
    if not _crypt32.CryptUnprotectData(
        ctypes.byref(in_blob), None, None, None, None, 0, ctypes.byref(out_blob)
    ):
        raise OSError("CryptUnprotectData failed")
    return _blob_to_bytes(out_blob)


def is_admin() -> bool:
    try:
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except Exception:
        return False


def elevate() -> None:
    params = " ".join(f'"{a}"' for a in sys.argv)
    ctypes.windll.shell32.ShellExecuteW(
        None, "runas", sys.executable, params, None, 1
    )
    sys.exit(0)


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
    if STATE_FILE.exists():
        try:
            raw = dpapi_decrypt(STATE_FILE.read_bytes()).decode("utf-8")
        except Exception:
            raw = None
    elif LEGACY_STATE_FILE.exists():
        try:
            raw = LEGACY_STATE_FILE.read_text(encoding="utf-8")
        except Exception:
            raw = None
        try:
            LEGACY_STATE_FILE.unlink()
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
    STATE_FILE.write_bytes(dpapi_encrypt(payload))


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


def _flush_dns() -> None:
    try:
        subprocess.run(
            ["ipconfig", "/flushdns"],
            capture_output=True,
            creationflags=subprocess.CREATE_NO_WINDOW,
            timeout=5,
        )
    except Exception:
        pass


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


def toggle_break() -> None:
    with state_lock:
        on_break = state["on_break"]
    if on_break:
        end_break()
    else:
        start_break()


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
        pystray.MenuItem(_menu_status_label, None, enabled=False),
        pystray.MenuItem(_menu_hotkey_label, None, enabled=False),
    )


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

    if not is_admin():
        elevate()
        return

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
