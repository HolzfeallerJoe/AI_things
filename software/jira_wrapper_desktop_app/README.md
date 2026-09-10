# Jira Desktop

Jira in its own window, so it does not have to live in a browser tab alongside forty
other tabs.

This is a dedicated Electron window pointed at your Jira instance. Everything Jira can
do, it can do &mdash; boards, drag and drop, creating and editing issues, comments,
assignees, the backlog &mdash; because it is the real Jira web app, just without a
browser wrapped around it.

## Install

Build the Windows installer:

```bash
npm install
npm run dist
```

That produces `dist/Jira-Desktop-Setup-<version>.exe`. Run it and you get a normal
installed application: a Start menu entry, a desktop shortcut, and an uninstaller under
"Apps & features". It installs per user, so it never asks for administrator rights.

The installer is unsigned, so SmartScreen will say "Windows protected your PC" the first
time. Choose **More info**, then **Run anyway**. Getting rid of that prompt needs a paid
code signing certificate.

### Running from source instead

```bash
npm install
npm start
```

## First launch

It asks which Jira to open. Paste the address you normally use
(`your-company.atlassian.net`, or your own host if you self-host); a full URL works too
and gets trimmed for you.

Sign in exactly as you would in a browser. The session lives in a persistent partition,
so you stay logged in across restarts. Single sign-on through Google, Microsoft, Okta,
Auth0, OneLogin and Ping is handled &mdash; those providers stay inside the app instead
of being kicked out to your browser mid-login.

## Keyboard

| Shortcut | Action |
| --- | --- |
| `Ctrl+Shift+H` | Back to your Jira home |
| `Alt+Left` / `Alt+Right` | Back / forward |
| `Ctrl+R` | Reload |
| `Ctrl+Shift+O` | Open the current page in your real browser |
| `Ctrl+,` | Change the Jira address |
| `Ctrl` `+` / `-` / `0` | Zoom |
| `F12` | Developer tools |
| `Alt` | Reveal the menu bar |

## Where your settings live

Nothing about your organisation is stored in this repository. Your Jira address and
window size are written to Electron's per-user data directory:

```
%APPDATA%\jira-desktop\config.json
```

Your Jira login lives in the app's own cookie store in that same directory, handled by
Chromium &mdash; this app never sees or stores your password or any API token.

`config.example.json` in the repo shows the file's shape and is the only copy git
tracks.

## How links are treated

- Your Jira host and Atlassian's own domains open in the window.
- Identity providers open in the window (or a popup) so single sign-on completes.
- Everything else &mdash; a linked GitHub PR, a Confluence page on another host, a
  customer's site &mdash; opens in your normal browser, where it belongs.

Host matching is exact or on a leading-dot suffix, so a lookalike domain such as
`evil-atlassian.net.example.com` is treated as external.

## Layout

```
src/main/main.ts     window lifecycle, single instance, link routing, IPC
src/main/config.ts   reads and writes the per-user config
src/main/links.ts    decides internal vs. external URLs
src/main/menu.ts     application menu and shortcuts
src/preload/         the tiny bridge the setup screen uses
src/renderer/        the first-run setup screen
scripts/             regenerates build/icon.png from code
```

The icon is drawn in code rather than checked in as an opaque binary; `npm run icon`
redraws it.

## Publishing this repo

The folder is self-contained: no path, credential or hostname outside it is referenced,
so it can be split into a public repository of its own with

```bash
git subtree split --prefix=software/jira_wrapper_desktop_app -b jira-desktop
```

Check that `config.json` is absent from the split before pushing &mdash; `.gitignore`
covers it, but it costs nothing to confirm.
