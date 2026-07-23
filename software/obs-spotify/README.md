# OBS Spotify "Now Playing" Overlay

A tiny local web server that shows the track currently playing in the **Spotify
desktop app** as a minimal text overlay in OBS. Add it to OBS as a **Browser
Source**.

```
♪ Song Title — Artist
```

**Works with a free Spotify account** — no developer app, no login, no Premium.
It reads Windows' media session (the same data behind your keyboard media keys),
so there's nothing to authorize.

## How it works

1. A small Python (Flask) server runs locally on `http://127.0.0.1:8888`.
2. It reads the current track from **Windows System Media Transport Controls
   (SMTC)** — whatever the Spotify desktop app reports to Windows.
3. OBS loads `http://127.0.0.1:8888/` as a Browser Source. The page polls the
   server every 2 seconds and updates the text, with a transparent background so
   only the text shows over your scene.

> **Scope:** this reads the Spotify **desktop app on this PC**. Music played from
> your phone or the Spotify web player is not visible to Windows' media session.

## Setup

```bash
pip install -r requirements.txt
python app.py
```

That's it — no config files or accounts. Then add it to OBS:

- **Sources → + → Browser**
- URL: `http://127.0.0.1:8888/`
- Set **Width/Height** to taste (e.g. 800 × 80).
- Position it in your scene. The background is transparent automatically.

Play a song in the Spotify desktop app and the text appears. Keep
`python app.py` running while you stream.

The overlay is a **Bootstrap card** (bundled locally, no CDN). The web page
shrink-wraps to the card, so the document is only as big as the card itself —
size your OBS Browser Source to match.

The card has a **fixed width and height**. Titles (and artist names) that are too
long to fit **scroll right-to-left** with a pause at each end. Set the OBS Browser
Source to the card's size (default 380 × 104).

## Customizing the look

Edit `static/overlay.html`:
- The `:root` CSS variables at the top control the fixed card size
  (`--card-width`, `--card-height`), cover size, colors, and the scroll speed
  (`--marquee-speed`, in px/second).
- The **Config** block in the `<script>` controls the poll interval, whether
  podcasts show, the eyebrow label, and `ENABLE_MARQUEE` — set it to `false` to
  truncate long titles with an ellipsis (`…`) instead of scrolling them.

Bootstrap is bundled at `static/vendor/bootstrap.min.css` so it works offline
inside OBS.

## Files
| File | Purpose |
|------|---------|
| `app.py` | Flask server: serves the overlay and the `/nowplaying` JSON |
| `media_session.py` | Reads the current track from Windows SMTC |
| `static/overlay.html` | The overlay page: Bootstrap card + polling |
| `static/vendor/bootstrap.min.css` | Bundled Bootstrap 5.3.3 (local, no CDN) |

## Troubleshooting
- **Nothing shows** — make sure the **Spotify desktop app** is running and a song
  is actually playing (not paused). The overlay hides itself when playback is
  stopped or Spotify is closed.
- **Wrong app's media shows** — the reader filters to the Spotify app
  specifically, so a browser video shouldn't appear. If Spotify still doesn't
  show, confirm it's the desktop app (not the web player).
- **`ModuleNotFoundError: winsdk`** — run `pip install -r requirements.txt` in the
  same Python you launch `app.py` with.
