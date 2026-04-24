"""RSS/Atom feed monitor that sends ntfy.sh notifications for matching articles."""

import base64
import html
import json
import logging
import logging.handlers
import os
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path


def _load_dotenv(path: Path) -> None:
    """Minimal .env loader — populates os.environ without overwriting existing vars."""
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        key, sep, value = line.partition("=")
        if not sep:
            continue
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_dotenv(Path(__file__).parent / ".env")


# --- Configuration ---
NTFY_TOPIC  = os.environ.get("NTFY_TOPIC", "")
NTFY_SERVER = os.environ.get("NTFY_SERVER", "https://ntfy.sh")
RSS_URL     = os.environ.get("RSS_URL", "https://www.nintendolife.com/feeds/latest")
DATA_FILE   = Path(os.environ.get("DATA_FILE") or Path(__file__).parent / "data" / "seen.json")

DEFAULT_KEYWORDS = [
    "switch 2",
    "nintendo switch 2",
]

# Comma-separated list, e.g. FILTER_KEYWORDS="switch 2,mario,zelda"
_env_keywords = [k.strip() for k in os.environ.get("FILTER_KEYWORDS", "").split(",") if k.strip()]
FILTER_KEYWORDS = _env_keywords or DEFAULT_KEYWORDS
# ---------------------

LOG_FILE = DATA_FILE.parent / "monitor.log"
LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

_log_format = logging.Formatter(
    "%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
_file_handler = logging.handlers.RotatingFileHandler(
    LOG_FILE, maxBytes=1_000_000, backupCount=3, encoding="utf-8",
)
_file_handler.setFormatter(_log_format)
_stream_handler = logging.StreamHandler()
_stream_handler.setFormatter(_log_format)

logging.basicConfig(level=logging.INFO, handlers=[_file_handler, _stream_handler])
log = logging.getLogger("rss-filter")

HTML_TAG_RE = re.compile(r"<[^>]+>")


@dataclass
class Article:
    guid: str
    title: str
    link: str
    description: str


def strip_html(text: str) -> str:
    return html.unescape(HTML_TAG_RE.sub(" ", text))


def load_seen() -> set[str]:
    try:
        return set(json.loads(DATA_FILE.read_text(encoding="utf-8")))
    except FileNotFoundError:
        return set()
    except (OSError, json.JSONDecodeError) as e:
        log.warning("Could not read %s (%s) — starting with empty state", DATA_FILE, e)
        return set()


def save_seen(seen: set[str]) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = DATA_FILE.with_suffix(DATA_FILE.suffix + ".tmp")
    tmp.write_text(json.dumps(sorted(seen)), encoding="utf-8")
    tmp.replace(DATA_FILE)


USER_AGENT = "Mozilla/5.0 (compatible; rss-feed-filter/1.0; +https://github.com/)"


def fetch_feed(url: str) -> ET.Element:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return ET.fromstring(resp.read())


def _local(tag: str) -> str:
    return tag.split("}", 1)[-1]


def parse_articles(root: ET.Element) -> list[Article]:
    """Parse both RSS 2.0 (<item>) and Atom (<entry>), ignoring namespaces."""
    articles: list[Article] = []
    for el in root.iter():
        if _local(el.tag) not in ("item", "entry"):
            continue
        guid = title = link = desc = ""
        for child in el:
            name = _local(child.tag)
            if name in ("guid", "id"):
                guid = (child.text or "").strip()
            elif name == "title":
                title = (child.text or "").strip()
            elif name == "link":
                link = (child.text or child.get("href") or "").strip()
            elif name in ("description", "summary"):
                desc = (child.text or "").strip()
        guid = guid or link
        if guid:
            articles.append(Article(guid, title, link, desc))
    return articles


def matches(article: Article) -> bool:
    haystack = (article.title + " " + strip_html(article.description)).lower()
    return any(kw.lower() in haystack for kw in FILTER_KEYWORDS)


def _encode_header(value: str) -> str:
    """RFC 2047 encoded-word so non-ASCII titles survive the HTTP header pipeline."""
    if value.isascii():
        return value
    b64 = base64.b64encode(value.encode("utf-8")).decode("ascii")
    return f"=?UTF-8?B?{b64}?="


def _post_ntfy(title: str, body: str, click: str = "", priority: str = "", tags: str = "") -> None:
    headers = {"Title": _encode_header(title)}
    if click:
        headers["Click"] = click
    if priority:
        headers["Priority"] = priority
    if tags:
        headers["Tags"] = tags
    req = urllib.request.Request(
        f"{NTFY_SERVER}/{NTFY_TOPIC}",
        data=body.encode("utf-8"),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10):
        pass


def send_startup_notification(feed_url: str, keywords: list[str]) -> None:
    if not NTFY_TOPIC:
        log.info("[DRY-RUN] Would send startup notification")
        return
    body = f"Feed: {feed_url}\nKeywords: {', '.join(keywords)}"
    _post_ntfy("RSS Monitor gestartet", body, tags="white_check_mark")
    log.info("Startup notification sent")


def send_error_notification(context: str, error: BaseException) -> None:
    """Notify about errors — swallow ntfy failures to avoid cascades."""
    if not NTFY_TOPIC:
        log.info("[DRY-RUN] Would send error notification: %s", context)
        return
    try:
        _post_ntfy(
            f"RSS Monitor Fehler: {context}",
            f"{type(error).__name__}: {error}",
            priority="high",
            tags="warning",
        )
        log.info("Error notification sent")
    except (urllib.error.URLError, OSError) as e:
        log.error("Could not send error notification: %s", e)


def send_notification(article: Article) -> None:
    if not NTFY_TOPIC:
        log.info("[DRY-RUN] Would notify: %s", article.title)
        return
    req = urllib.request.Request(
        f"{NTFY_SERVER}/{NTFY_TOPIC}",
        data=article.link.encode("utf-8"),
        headers={
            "Title": _encode_header(article.title),
            "Click": article.link,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10):
        pass
    log.info("Notified: %s", article.title)


def main() -> int:
    log.info("Filter keywords: %s", FILTER_KEYWORDS)

    if not NTFY_TOPIC:
        log.warning("NTFY_TOPIC is not set — running in dry-run mode")

    try:
        root = fetch_feed(RSS_URL)
    except (urllib.error.URLError, OSError, ET.ParseError) as e:
        log.error("Could not fetch feed %s: %s", RSS_URL, e)
        send_error_notification(f"Feed nicht erreichbar ({RSS_URL})", e)
        return 1

    articles = parse_articles(root)
    log.info("Fetched %d articles from %s", len(articles), RSS_URL)

    seen = load_seen()
    if not seen:
        log.info("First run — marking %d articles as seen, no notifications sent", len(articles))
        save_seen({a.guid for a in articles})
        try:
            send_startup_notification(RSS_URL, FILTER_KEYWORDS)
        except (urllib.error.URLError, OSError) as e:
            log.error("Failed to send startup notification: %s", e)
        return 0

    new_seen = set(seen)
    notified = 0
    for article in articles:
        if article.guid in seen:
            continue
        if not matches(article):
            new_seen.add(article.guid)
            continue
        try:
            send_notification(article)
            notified += 1
            new_seen.add(article.guid)
        except (urllib.error.URLError, OSError) as e:
            # Do not mark as seen — retry on next run.
            log.error("Failed to notify for %s: %s — will retry next run", article.title, e)

    save_seen(new_seen)
    log.info("Done — %d new notifications sent", notified)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        log.exception("Unexpected error")
        send_error_notification("Unerwarteter Fehler", e)
        sys.exit(1)
