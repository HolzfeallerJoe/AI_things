# RSS Feed Monitor → ntfy

Überwacht einen RSS-Feed und schickt Push-Benachrichtigungen via [ntfy.sh](https://ntfy.sh) für neue Artikel, die auf bestimmte Keywords matchen.

## Setup

1. **ntfy Topic anlegen** auf ntfy.sh (z.B. `mein-switch2-monitor`)
2. **Keywords anpassen** in `monitor.py` → `FILTER_KEYWORDS`
3. **Manuell testen:**
   ```bash
   NTFY_TOPIC=mein-topic python3 monitor.py
   ```
   Beim ersten Aufruf werden alle aktuellen Artikel als gesehen markiert (kein Spam).

## Umgebungsvariablen

| Variable           | Pflicht | Standard                                   | Beschreibung                              |
|--------------------|---------|--------------------------------------------|-------------------------------------------|
| `NTFY_TOPIC`       | Ja      | —                                          | ntfy.sh Topic-Name                        |
| `NTFY_SERVER`      | Nein    | `https://ntfy.sh`                          | ntfy Server-URL                           |
| `RSS_URL`          | Nein    | `https://www.nintendolife.com/feeds/latest`| RSS-Feed URL                              |
| `FILTER_KEYWORDS`  | Nein    | `switch 2,nintendo switch 2`               | Komma-getrennte Liste (Fallback: Default) |
| `DATA_FILE`        | Nein    | `data/seen.json` (neben monitor.py)        | Pfad zur Zustandsdatei                    |

## Keywords anpassen

Am einfachsten per Env-Var (komma-getrennt):
```bash
FILTER_KEYWORDS="switch 2,mario,zelda,eu version" NTFY_TOPIC=mein-topic python3 monitor.py
```

Oder dauerhaft die Defaults in `monitor.py` ändern (`DEFAULT_KEYWORDS`):
```python
DEFAULT_KEYWORDS = [
    "switch 2",
    "nintendo switch 2",
]
```

## TrueNAS Cron Job

**TrueNAS SCALE** (System → Advanced → Cron Jobs):
```
0 9 * * 0   python3 /mnt/pool/scripts/rss-feed-filter/monitor.py
```

**TrueNAS CORE** (Tasks → Cron Jobs):
```
0 9 * * 0   python3 /mnt/pool/scripts/rss-feed-filter/monitor.py
```

→ Läuft jeden **Sonntag um 09:00 Uhr**.

Umgebungsvariablen im Cron-Befehl setzen:
```
NTFY_TOPIC=mein-topic FILTER_KEYWORDS="switch 2,zelda" python3 /mnt/pool/scripts/rss-feed-filter/monitor.py
```
