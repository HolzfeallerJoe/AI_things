"""Local Flask server that powers the OBS "Now Playing on Spotify" overlay.

Reads the Spotify desktop app's track from Windows' media session (SMTC), so it
works with a free Spotify account -- no developer app, login, or Premium needed.

Routes:
    GET /            -> the overlay page (add this URL as an OBS Browser Source)
    GET /nowplaying  -> JSON the overlay polls for the current track
"""
from __future__ import annotations

import logging
import os

import flask.cli
from flask import Flask, jsonify, send_from_directory

import media_session

# Quiet the dev server: drop the per-request access log spam and the startup
# banner, leaving only our own three status lines below.
logging.getLogger("werkzeug").setLevel(logging.ERROR)
flask.cli.show_server_banner = lambda *args, **kwargs: None

# Port the local server listens on (override with the PORT env var if needed).
PORT = int(os.getenv("PORT", "8888"))

app = Flask(__name__, static_folder="static")


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "overlay.html")


@app.route("/nowplaying")
def nowplaying():
    return jsonify(media_session.get_currently_playing())


if __name__ == "__main__":
    print(f"OBS Spotify overlay running on http://127.0.0.1:{PORT}", flush=True)
    print(f"  -> Add this URL as an OBS Browser Source: http://127.0.0.1:{PORT}/", flush=True)
    print("  -> Keep this window open while you stream. Ctrl+C to stop.", flush=True)
    # host=127.0.0.1 keeps the server loopback-only.
    app.run(host="127.0.0.1", port=PORT, debug=False)
