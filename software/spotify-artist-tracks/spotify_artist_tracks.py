#!/usr/bin/env python3
from __future__ import annotations

import argparse
import difflib
import json
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


@dataclass
class TrackStats:
    play_count: int = 0
    total_ms_played: int = 0
    artist: str = ""
    first_listen_ts: str = ""
    last_listen_ts: str = ""


def normalize(text: str) -> str:
    return " ".join(text.casefold().split())


def validate_data_dir(data_dir: Path) -> Path:
    if not data_dir.exists():
        raise FileNotFoundError(f"Spotify data directory does not exist: {data_dir}")
    if not data_dir.is_dir():
        raise FileNotFoundError(f"Spotify data path is not a directory: {data_dir}")

    readme_path = data_dir / "ReadMeFirst_ExtendedStreamingHistory.pdf"
    if not readme_path.is_file():
        raise FileNotFoundError(
            "Spotify data directory is missing ReadMeFirst_ExtendedStreamingHistory.pdf: "
            f"{data_dir}"
        )

    return data_dir


def audio_history_files(data_dir: Path) -> list[Path]:
    data_dir = validate_data_dir(data_dir)
    files = sorted(data_dir.glob("Streaming_History_Audio_*.json"))
    if not files:
        raise FileNotFoundError(
            f"No audio history files found in {data_dir!s}. Expected files like "
            "Streaming_History_Audio_2025-2026_10.json."
        )
    return files


def iter_song_streams(files: Iterable[Path]) -> Iterable[dict]:
    for path in files:
        with path.open("r", encoding="utf-8") as handle:
            entries = json.load(handle)
        for entry in entries:
            artist = entry.get("master_metadata_album_artist_name")
            track = entry.get("master_metadata_track_name")
            if artist and track:
                yield entry


def collect_tracks_by_artist(files: Iterable[Path], requested_artist: str) -> tuple[str | None, dict[str, TrackStats], dict[str, int]]:
    requested_key = normalize(requested_artist)
    artist_name_counts: dict[str, Counter[str]] = defaultdict(Counter)
    artist_play_counts: dict[str, int] = Counter()
    tracks: dict[str, TrackStats] = {}

    for entry in iter_song_streams(files):
        artist = str(entry["master_metadata_album_artist_name"]).strip()
        artist_key = normalize(artist)

        artist_name_counts[artist_key][artist] += 1
        artist_play_counts[artist_key] += 1

        if artist_key != requested_key:
            continue

        track = str(entry["master_metadata_track_name"]).strip()
        stats = tracks.setdefault(track, TrackStats())
        stats.play_count += 1
        stats.total_ms_played += int(entry.get("ms_played") or 0)
        stats.artist = artist

        ts = str(entry.get("ts") or "")
        if ts:
            if not stats.first_listen_ts or ts < stats.first_listen_ts:
                stats.first_listen_ts = ts
            if not stats.last_listen_ts or ts > stats.last_listen_ts:
                stats.last_listen_ts = ts

    canonical_names = {
        key: names.most_common(1)[0][0]
        for key, names in artist_name_counts.items()
    }

    return canonical_names.get(requested_key), tracks, {
        canonical_names[key]: count for key, count in artist_play_counts.items()
    }


def format_duration(total_ms: int) -> str:
    total_seconds = round(total_ms / 1000)
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    if hours:
        return f"{hours}h {minutes}m {seconds}s"
    if minutes:
        return f"{minutes}m {seconds}s"
    return f"{seconds}s"


def format_listen_date(ts: str) -> str:
    return ts[:10] if ts else "-"


def render_table(headers: list[str], rows: list[list[str]]) -> str:
    widths = [len(header) for header in headers]
    for row in rows:
        for idx, cell in enumerate(row):
            widths[idx] = max(widths[idx], len(cell))

    def format_row(row: list[str]) -> str:
        return " | ".join(cell.ljust(widths[idx]) for idx, cell in enumerate(row))

    separator = "-+-".join("-" * width for width in widths)
    lines = [format_row(headers), separator]
    lines.extend(format_row(row) for row in rows)
    return "\n".join(lines)


def edit_distance(left: str, right: str) -> int:
    if left == right:
        return 0
    if not left:
        return len(right)
    if not right:
        return len(left)

    previous = list(range(len(right) + 1))
    for i, left_char in enumerate(left, start=1):
        current = [i]
        for j, right_char in enumerate(right, start=1):
            insertion = current[j - 1] + 1
            deletion = previous[j] + 1
            substitution = previous[j - 1] + (left_char != right_char)
            current.append(min(insertion, deletion, substitution))
        previous = current
    return previous[-1]


def suggest_artists(requested_artist: str, artist_play_counts: dict[str, int], limit: int = 8) -> list[str]:
    query = normalize(requested_artist)
    if not query:
        return []

    scored: dict[str, float] = {}

    for artist in artist_play_counts:
        artist_key = normalize(artist)
        score = difflib.SequenceMatcher(a=query, b=artist_key).ratio()
        distance = edit_distance(query, artist_key)

        if query in artist_key or artist_key in query:
            score += 0.35
        if artist_key.startswith(query):
            score += 0.2
        if len(query) <= 3 and len(artist_key) <= 3 and distance <= 1:
            score += 0.75
        elif abs(len(query) - len(artist_key)) <= 1 and distance == 1:
            score += 0.25
        if score >= 0.45:
            scored[artist] = max(scored.get(artist, 0.0), score)

    for artist in difflib.get_close_matches(requested_artist, artist_play_counts.keys(), n=limit, cutoff=0.45):
        scored[artist] = max(scored.get(artist, 0.0), 0.45)

    ranked = sorted(
        scored,
        key=lambda artist: (scored[artist], artist_play_counts[artist], artist.casefold()),
        reverse=True,
    )
    return ranked[:limit]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Print every Spotify track you have heard from a given artist.",
    )
    parser.add_argument(
        "data_dir",
        nargs="?",
        type=Path,
        help="Path to the Spotify Extended Streaming History folder.",
    )
    parser.add_argument(
        "artist",
        nargs="?",
        help="Artist name to look up. Matching is case-insensitive.",
    )
    return parser


def print_artist_results(requested_artist: str, files: list[Path]) -> int:
    matched_artist, tracks, artist_play_counts = collect_tracks_by_artist(files, requested_artist)

    if not matched_artist:
        suggestions = suggest_artists(requested_artist, artist_play_counts)
        print(f'No exact artist match found for "{requested_artist}".')
        if suggestions:
            print("Did you mean:")
            for artist in suggestions:
                print(f"  - {artist} ({artist_play_counts[artist]} plays)")
        else:
            print("No close artist matches found.")
        return 1

    total_plays = sum(stat.play_count for stat in tracks.values())
    total_ms = sum(stat.total_ms_played for stat in tracks.values())

    print(f'Artist: {matched_artist}')
    print(f"Unique tracks heard: {len(tracks)}")
    print(f"Total plays: {total_plays}")
    print(f"Total listening time: {format_duration(total_ms)}")
    print("")

    rows: list[list[str]] = []
    for track, stats in sorted(
        tracks.items(),
        key=lambda item: (-item[1].play_count, item[0].casefold()),
    ):
        rows.append(
            [
                track,
                str(stats.play_count),
                format_duration(stats.total_ms_played),
                stats.artist or matched_artist,
                format_listen_date(stats.first_listen_ts),
                format_listen_date(stats.last_listen_ts),
            ]
        )

    print(
        render_table(
            [
                "Song title",
                "Number of plays",
                "Accumulated time",
                "Artist",
                "First listen date",
                "Last listen date",
            ],
            rows,
        )
    )

    return 0


def prompt_for_data_dir() -> Path | None:
    while True:
        try:
            raw_path = input(
                "Spotify data folder (or press Enter / type 'quit' to exit): "
            ).strip()
        except (EOFError, KeyboardInterrupt):
            print("")
            return None

        if not raw_path or normalize(raw_path) in {"quit", "exit"}:
            return None

        candidate = Path(raw_path).expanduser()
        try:
            return validate_data_dir(candidate)
        except FileNotFoundError as exc:
            print(exc)
            print("")


def interactive_mode(files: list[Path], show_banner: bool = True) -> int:
    if show_banner:
        print("Spotify artist track lookup")
    print("Enter an artist name. Type 'quit' or press Enter on an empty line to exit.")
    print("")

    while True:
        try:
            artist = input("Artist name: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("")
            return 0

        if not artist or normalize(artist) in {"quit", "exit"}:
            return 0

        print("")
        print_artist_results(artist, files)
        print("")


def main() -> int:
    args = build_parser().parse_args()

    try:
        if args.data_dir:
            files = audio_history_files(args.data_dir.expanduser())
        else:
            print("Spotify artist track lookup")
            print("")
            data_dir = prompt_for_data_dir()
            if data_dir is None:
                return 0
            print("")
            files = audio_history_files(data_dir)
    except FileNotFoundError as exc:
        print(exc, file=sys.stderr)
        return 2
    except json.JSONDecodeError as exc:
        print(f"Failed to parse Spotify JSON: {exc}", file=sys.stderr)
        return 2

    if args.artist:
        return print_artist_results(args.artist, files)

    return interactive_mode(files, show_banner=bool(args.data_dir))


if __name__ == "__main__":
    raise SystemExit(main())
