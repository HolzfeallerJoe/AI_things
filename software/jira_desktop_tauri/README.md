# Jira Native

A Jira client that talks to the REST API and draws its own interface. There is no
browser engine in this process and nothing ever loads a page from Atlassian.

This is the counterpart to `../jira_wrapper_desktop_app`, which is an Electron window
around the Jira website. The two exist to make the difference concrete: that one is a
website in a frame, this one is an application.

## Features

- **My issues** from any JQL query, with a live filter over key, summary and description.
- **Spaces** - boards grouped by the project they belong to, with a search over both.
  Pin boards to a virtual **Favourites** space so the ones you actually use stay one
  click away. Opening a board shows its columns, read from the board's own
  configuration, with **drag and drop between columns** to change status, and the
  selected ticket alongside it.
- **Backlog** for whichever board is open.
- **Create issues** - project, type, summary, description, priority.
- **Edit** summary and description in place.
- **Assign people**, searching the users Jira says may be assigned to that issue.
- **Status changes** through the real workflow transitions Jira offers.
- **Comments** - read the thread, write a new one.
- **Open in browser** for anything this does not cover.

## Install

```bash
cargo build --release
makensis installer\installer.nsi
```

That produces `target\release\Jira-Native-Setup-0.1.0.exe`. It installs per user into
`%LOCALAPPDATA%\Programs\JiraNative`, so it never asks for administrator rights, and
gives you a Start menu entry, a desktop shortcut and an uninstaller under
"Apps & features".

The installer is unsigned, so SmartScreen objects the first time: **More info** then
**Run anyway**. Removing that prompt needs a paid code signing certificate.

Uninstalling deliberately leaves your saved address and keychain token alone, so
reinstalling does not mean setting everything up again.

### Running without installing

```bash
cargo run --release
```

The binary is self-contained - copy `target\release\jira-native.exe` anywhere.

## Build requirements

A Rust toolchain, and [NSIS](https://nsis.sourceforge.io/) on PATH for the installer
step. No Node, no npm, no JavaScript anywhere in the app.

```bash
cargo test              # 23 tests
```

Node is used for one optional thing - redrawing the icons:

```bash
node scripts/generate-icons.mjs
```

## First run

It asks for three things:

- **Jira address** - `your-company.atlassian.net`, or your own host if you self-host.
- **Atlassian e-mail** - the user half of the credential.
- **API token** - from [id.atlassian.com](https://id.atlassian.com/manage-profile/security/api-tokens).

There is no browser login and no OAuth dance, because there is no browser.

## Where things live

The address, e-mail and JQL go to a config file:

```
%APPDATA%\HolzfeallerJoe\jira-native\config\config.json
```

**The API token does not.** It goes to the operating system credential store - Windows
Credential Manager, macOS Keychain, or the Secret Service on Linux - keyed by your
e-mail, so nothing secret sits in plain text on disk. "Sign out" in the settings dialog
deletes it from there.

Nothing about your organisation is stored in this repository.

## Editing descriptions, and what it will not do

Jira stores descriptions as Atlassian Document Format, a node tree rather than text.
This app edits them **as plain text**, which round-trips exactly for a plain
description and would otherwise throw away tables, images, links and styling.

So it checks first. If the description is plain, Edit behaves normally. If it contains
anything that would not survive, the editor shows a warning, the button reads
**Save as plain text**, and "Open in browser" is right there. Silently destroying
someone's formatted description is the one behaviour worth going out of the way to
prevent.

The same honesty applies to display: an unrecognised node renders as a visible marker
such as `[table - open in browser]` rather than disappearing.

## Spaces and boards

Jira's REST API has no concept of "spaces" - boards always belong to a project - so the
spaces panel groups boards by their project. Boards built from a filter spanning several
projects report no project at all and are collected under "Without a space" rather than
being dropped.

Favourites are stored locally in the config file, because the API does not expose which
boards you have starred in the web interface. They are yours here, separate from there.

Columns come from the board's own configuration, so they match what you see on the web,
including which statuses map to which column.

Dragging a card moves the issue by finding a workflow transition that lands on one of
the target column's statuses. When Jira's workflow has no such move, it says so instead
of pretending. Reordering *within* a column is not implemented - that is a ranking
operation, not a status change.

## Layout

```
src/main.rs         window setup and entry point
src/app.rs          the interface - every pixel drawn by egui
src/jira.rs         REST client, and readable errors from Jira JSON
src/adf.rs          Atlassian Document Format to drawable blocks
src/credentials.rs  API token in the OS keychain
src/config.rs       address, e-mail, JQL, and domain parsing
src/worker.rs       network calls off the UI thread
src/theme.rs        palette, chips, avatars, dialog chrome
src/diagnostics.rs  start, clean exit and panics, in a log file
installer/          NSIS script for the Windows installer
```

Network requests never run on the UI thread: each task gets a thread and reports back
through a channel, waking the interface with `request_repaint`.
