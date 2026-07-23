# Required Deliverables

Every implementation of `REQUIREMENTS.md` must produce all of the following inside its
`wifi-sound-thing-<model>` folder. The project is not complete while any item is missing.

## 1. Source code

- The complete, buildable source of the application (and of any helper software the
  solution needs), organized in a clean project structure.

## 2. README.md (project root)

Written so a technically average user can follow it, containing:

- **What it is** — one short paragraph describing the app.
- **Prerequisites** — every tool, SDK, and version needed to build and run, and where to
  get them for free.
- **Build instructions** — the exact commands to go from a fresh checkout to an
  installable app, including how to deploy it onto a phone.
- **Usage guide** — step-by-step instructions for the host and for the client, including
  any one-time setup the solution requires, written for a non-technical user.
- **Known limitations** — honest list of what does not work, explicitly including which
  kinds of apps the audio capture can and cannot record (see FR-4).

## 3. docs/DECISIONS.md

A decision log. For every significant design decision — at minimum: audio capture
strategy, technology stack, network transport, audio format/codec, and host discovery —
record:

- the options that were considered,
- the option chosen and the reasoning,
- the trade-offs accepted.

If a decision was made by asking the user, note that and record the user's choice.

## 4. Automated tests

- Tests covering the core logic, as required by NFR-7, plus a documented command to run
  them.

## 5. docs/VERIFICATION.md

An honest statement of what was and was not verified:

- what was actually executed and confirmed working (e.g. build succeeds, tests pass),
  with the commands used,
- what could not be verified in the development environment (e.g. real device-to-device
  audio, latency, Bluetooth output) and therefore awaits manual testing by the user.

Do not claim the acceptance criteria of `REQUIREMENTS.md` are met unless they were
genuinely tested end to end; final acceptance testing on real phones is performed by the
user.
