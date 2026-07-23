"""Read the current track (and album art) from Windows System Media Transport
Controls (SMTC).

No Spotify account, developer app, or Premium is needed. This reads whatever the
Spotify desktop app reports to Windows' media session -- the same data behind the
keyboard media keys and the volume flyout.

Only the Spotify desktop app on THIS PC is read; music on a phone or the web
player is not visible to SMTC.
"""
from __future__ import annotations

import asyncio
import base64

from winsdk.windows.media.control import (
    GlobalSystemMediaTransportControlsSessionManager as MediaManager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus as PlaybackStatus,
)
from winsdk.windows.storage.streams import (
    Buffer,
    DataReader,
    InputStreamOptions,
)

# SMTC identifies each player by its app id; Spotify's contains "spotify".
SPOTIFY_APP_ID_HINT = "spotify"

EMPTY = {"playing": False, "title": "", "artist": "", "is_track": True, "cover": ""}

# Album art is the same for a whole track, so cache it per track to avoid
# re-reading and re-encoding the image on every 2-second poll.
_cover_cache = {"key": None, "data_uri": ""}


def _find_spotify_session(manager):
    """Return the Spotify media session, or None if it isn't running."""
    try:
        sessions = manager.get_sessions()
    except Exception:
        sessions = None

    if sessions is not None:
        for session in sessions:
            app_id = (session.source_app_user_model_id or "").lower()
            if SPOTIFY_APP_ID_HINT in app_id:
                return session

    # Fall back to whatever the OS considers the current session.
    current = manager.get_current_session()
    if current is not None:
        app_id = (current.source_app_user_model_id or "").lower()
        if SPOTIFY_APP_ID_HINT in app_id:
            return current
    return None


def _guess_mime(data: bytes) -> str:
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    return "image/jpeg"  # Spotify art is JPEG in practice


async def _read_thumbnail(thumb_ref) -> str:
    """Read the album art stream and return it as a base64 data URI ("" if none)."""
    if thumb_ref is None:
        return ""
    try:
        stream = await thumb_ref.open_read_async()
        size = stream.size
        if not size:
            return ""
        buffer = Buffer(size)
        await stream.read_async(buffer, size, InputStreamOptions.READ_AHEAD)
        reader = DataReader.from_buffer(buffer)
        out = bytearray(buffer.length)
        reader.read_bytes(out)  # fills `out` in place
        data = bytes(out)
        if not data:
            return ""
        b64 = base64.b64encode(data).decode("ascii")
        return f"data:{_guess_mime(data)};base64,{b64}"
    except Exception:
        return ""


async def _read_async() -> dict:
    manager = await MediaManager.request_async()
    session = _find_spotify_session(manager)
    if session is None:
        return dict(EMPTY)

    props = await session.try_get_media_properties_async()
    playback = session.get_playback_info()
    is_playing = playback.playback_status == PlaybackStatus.PLAYING

    title = props.title or ""
    artist = props.artist or ""

    # Only re-read the cover when the track changes.
    key = f"{title}␟{artist}"
    if _cover_cache["key"] == key and _cover_cache["data_uri"]:
        cover = _cover_cache["data_uri"]
    else:
        cover = await _read_thumbnail(props.thumbnail)
        _cover_cache["key"] = key
        _cover_cache["data_uri"] = cover

    return {
        "playing": bool(is_playing),
        "title": title,
        "artist": artist,
        "is_track": True,
        "cover": cover,
    }


def get_currently_playing() -> dict:
    """Synchronous wrapper returning a simplified now-playing dict.

    Shape: {"playing": bool, "title": str, "artist": str, "is_track": bool,
            "cover": str}  -- "cover" is a base64 image data URI or "".
    Returns the empty/not-playing shape when Spotify isn't running.
    """
    try:
        return asyncio.run(_read_async())
    except Exception:
        # Spotify not running, no media session yet, or a transient SMTC hiccup.
        return dict(EMPTY)
