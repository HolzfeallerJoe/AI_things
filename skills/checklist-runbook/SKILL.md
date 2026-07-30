---
name: checklist-runbook
description: Build a single-file, self-contained HTML runbook — an interactive checklist with saved progress, filtering, and embedded screenshots. Use when asked for a test plan, QA checklist, release runbook, onboarding guide, migration plan, or any "give me a checklist / step-by-step doc" that a person will work through and tick off. Also use when converting an existing Markdown checklist into something usable.
---

# Checklist runbook

A runbook is one HTML file a person opens, works top to bottom, and ticks off.
Progress is saved in their browser. It filters to just the variant they are
running. It ships as a single attachment with no folder beside it.

Markdown is the wrong format for this: there is nowhere to record progress,
no way to hide the half that does not apply, and no visual reference.

## Start here

`template.html` is a working runbook with a demo plan showing every item type.
Copy it, replace the `PLAN` array, change `KEY`, edit the title and lede. Do not
rebuild the shell — the CSS and rendering logic are the parts that are already
debugged.

```
cp ~/.claude/skills/checklist-runbook/template.html my-runbook.html
```

Then verify before handing it over:

```
node ~/.claude/skills/checklist-runbook/scripts/verify-runbook.mjs my-runbook.html
```

## Scope: get it running, then verify it

A runbook takes the reader from nothing to done. That is two halves, and **both
belong in the document by default**:

1. **Get it running** — services, dependencies, build, install, credentials.
   Where a secret or account is needed, say where it comes from.
2. **Verify it** — the checks themselves.

A checklist that opens at "launch the app and tap Home" is useless to the one
person you handed it to: someone who does not already have it running. Include
setup unless the user says to drop it. If setup is documented elsewhere and is
genuinely stable, still give the short path — the three commands that work — and
link out for the detail.

**Model the ways of running it as the `kind` axis.** Local backend vs staging vs
production, device vs browser, one tenant vs another. Tag the setup sections
with it and the reader picks one and never sees the other. This is usually the
most valuable structure in the whole document, because the setup halves differ
completely while the verification half is shared.

**Ask once, and ask about what varies.** If something is genuinely ambiguous,
ask a single round covering: which environments or variants to include, which
platforms, and screenshots (see below). Do not ask "what should this runbook
cover?" — the reader cannot answer that better than you can, and a vague answer
leads to a document that quietly omits half the job. Ask about the axes.

## Content model

Everything lives in one `PLAN` array. The renderer is generic — never hand-write
repeated HTML.

```js
{
  id: 'setup', num: '01', group: 'Setup', kind: 'both',
  title: 'Section title',
  blurb: 'One line: what this is for and when it applies.',
  items: [ /* ... */ ]
}
```

| Item | Shape | Use for |
| --- | --- | --- |
| `check` | `{ t:'check', id, txt, sub?, code?, shot?, shotCap?, kind?, plat? }` | The tickable step |
| `note` | `{ t:'note', variant:'tip'\|'warn'\|'stop', icon, html }` | A caveat that is not a step |
| `rule` | `{ t:'rule', txt }` | Sub-heading inside a section |
| `code` | `{ t:'code', code:[lines] }` | Standalone command block |
| `table` | `{ t:'table', rows:[[q, a, kind?, plat?]] }` | Reference material |

`kind` (`a` / `b` / `both`) and `plat` (`android` / `ios` / `any`) work on
sections, items and table rows. A section's value is the default; an item
overrides it. Everything is filtered by both axes at once.

## Writing the checks

**Imperative, one action, one observable outcome.** "Search for nonsense. You
must get a clean empty state, not a spinner" beats "empty states work".

**Quote the exact expected string** when you know it. A tester who sees
different words should be able to tell instantly whether that is the bug.

**Put the why in `sub`.** The `txt` line is what you do; `sub` is the trap, the
rationale, or the exact wording.

**Split combined checks.** "Large fonts and the screen reader" is two checks. If
someone later deletes one concern, the other should not vanish with it.

## Order the sections by what testing consumes

This is the part most checklists get wrong. Some state can only be observed
once, so the order is not a matter of taste:

- A **fresh install** is spent the moment you configure anything. Everything
  needing factory defaults, first-run flows and empty states goes first — and
  include a step to *write the defaults down*, because "was that the default?"
  is unanswerable afterwards.
- A **permission prompt** fires once per install. Test deny-then-recover before
  anything grants it.
- **Destructive automation goes last.** E2E suites that reset app state will
  destroy a manual session. Say so, in a `stop` note, on the step itself.
- **Let passes feed each other.** Have one section deliberately leave state
  behind ("save one item and note which"), then a later section verify it
  survived a restart. One restart checkpoint beats a restart per section.

State the ordering rules on the steps that enforce them, not in a preamble —
preambles get skipped.

## Verify content against the implementation, not the strings file

The most common defect in a generated runbook is describing screens that do not
exist. Translation and constant files accumulate dead keys; writing checks from
them produces confident, wrong instructions.

- Read the **templates**, not just the i18n bundle. Grep each key you intend to
  quote and confirm something renders it.
- Read the **e2e tests**. They encode the real flow, the real labels and the
  real order, and they are maintained. They are the best single source.
- **Screenshot the running app** if you can (below). It settles arguments no
  amount of source reading will.

Budget real time for this pass. On a mature app it routinely finds whole
sections describing screens that were removed releases ago — the strings
survive in the bundle long after the UI that rendered them is gone.

## Screenshots

A runbook about a UI is markedly better with them — a tester recognises the
screen instead of parsing a description. So **aim to include them**, but do not
invent them and do not silently skip them.

### Decide how you will get them

**If you can already reach the running app, just take them.** A connected device
or emulator, a dev server you can drive, a Playwright/Maestro setup already in
the repo, or existing captures committed somewhere — use it and tell the user
what you did.

**Otherwise ask** — folded into the single round of questions from *Scope*
above, not as a separate interruption. Do not guess, and do not build the whole
document first: `shot:` fields are far easier to place while writing the steps
than to retrofit. Two parts:

1. Do you want screenshots in this runbook?
2. If yes, how should I get them — and cover the realistic options:
   - **I drive the app myself** — needs a device/emulator connected, or a URL and
     a browser tool. Say which screens matter, or let me walk the main flow.
   - **You send them** — drop the files in a folder and tell me where; name them
     after the screen so I can wire them to the right steps.
   - **Existing captures** — e2e artefacts, a design file, docs, a shared drive.
     Say where and I will pull from there.
   - **None** — the runbook still works; it just leans harder on exact quoted
     strings to identify each screen.

Then say what it costs: embedded screenshots make the file self-contained but
push it from ~70 KB to several hundred; linked ones keep it small but mean
shipping a folder alongside.

### Taking them yourself

Capture from the device, not by grabbing a mirroring window — you get full
resolution and no window chrome. Drive the app with `adb` to reach each screen:

```sh
adb exec-out screencap -p > shot.png     # capture
adb shell input tap <x> <y>              # navigate
adb shell dumpsys window displays        # screen size, to scale tap coords
```

Scale tap coordinates from the screenshot you are reading to the real display
size. If you change anything to get a clean capture — app language, a setting, a
test account — **put it back afterwards and say so**.

Never fabricate a screenshot, and never pass off a stale or unrelated capture as
current. A failure screenshot from an old CI run is not reference material; if
that is all that exists, say so and offer to take fresh ones.

### Converting and embedding

```sh
pwsh ~/.claude/skills/checklist-runbook/scripts/to-jpeg.ps1 -InDir ./shots
node ~/.claude/skills/checklist-runbook/scripts/bake-screenshots.mjs my-runbook.html ./shots/jpg
```

Rules that matter:

- **JPEG before base64.** Raw PNGs plus base64 overhead will triple your file
  size. 520px at quality 82 is legible and roughly 5× smaller.
- **Keys, not payloads, in the DOM.** Buttons carry the file name and look up
  `SHOTS` at click time. Putting data URIs in attributes parks megabytes of
  base64 in the document.
- **Behind a button.** Inline thumbnails wreck the density of a checklist and
  force every image to load up front.
- **Caption by screen, not by file.** "Profile · build badge" tells a tester
  what they are about to look at; `07-profile-settings.png` does not.

## Hard-won details

- **Boot before progressive enhancement.** Render and restore progress *before*
  wiring `IntersectionObserver` or any optional API. Reveal animations that gate
  content will show a blank page if the observer throws. Feature-check and
  `try`/`catch` it.
- **Stable check ids.** Progress is keyed by `id`. Rewording is free; renaming
  an id silently discards a tester's tick. Keep ids across edits.
- **One storage key per document.** Two runbooks in the same origin will share
  and corrupt progress otherwise. Change `KEY` first, before anything else.
- **The meter must equal the view.** Whenever filters change what is visible,
  the progress total and per-section counts must be recomputed over the same
  scope. `verify-runbook.mjs` asserts this across every filter combination.
- **Anything bulky gets its own storage key** so hitting the quota cannot take
  progress down with it.
- **Truly self-contained.** No CDN, no web fonts, no external CSS. Use system
  font stacks and inline SVG data URIs for texture. Verify with a grep for
  `src="`/`href="http`.
- **Degrade loudly.** A missing screenshot should say "not embedded", not show
  a broken frame.
- **Print rules.** Hide the toolbar, rail and buttons; keep the content.

## Verifying

`scripts/verify-runbook.mjs` checks what opening the file cannot: duplicate ids,
meter/view mismatch per filter combination, unresolved screenshots, blank
render, progress round-trip, and corrupt-storage recovery.

It needs `jsdom` — the only dependency in the skill. Install it once beside the
skill and it works from any project:

```sh
npm i jsdom --prefix ~/.claude/skills/checklist-runbook
```

The other two scripts need nothing. `to-jpeg.ps1` uses Windows `System.Drawing`;
on macOS or Linux use `sips -Z 520` or `magick convert -resize 520x -quality 82`
instead and hand the results to `bake-screenshots.mjs` unchanged.

When editing an existing runbook programmatically, **assert before writing** —
check every identifier you meant to remove is gone, and write only if the whole
file is clean. A partially stripped document is worse than an unedited one.

## Multiple editions

Different readers want different things from the same material, and one file
cannot serve all of them:

- **detailed** — exact screens, strings and buttons for the current build
- **general** — behaviour-level cases that survive a redesign
- **guided** — an ordered session with instructions and a flow

They can share a shell and screenshots. Give each its own `KEY`, and link
between them in the lede — except a self-contained edition meant for emailing,
which should not link to files that did not travel with it.
