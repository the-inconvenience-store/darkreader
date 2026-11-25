# Agent Instructions

This repository is a fork of [DarkReader](https://github.com/darkreader/darkreader).
Treat `origin` (`the-inconvenience-store/darkreader`) as the writable fork and
`upstream` (`darkreader/darkreader`) as the canonical, read-only source. Do not
push to `upstream` or open an upstream pull request unless the user explicitly
asks.

## Project Overview

Dark Reader is a browser extension and JavaScript API that generates dark
themes for websites. The main implementation is TypeScript and TSX:

- `src/background/` contains extension background logic.
- `src/inject/` runs in web pages and applies theme changes.
- `src/generators/` implements theme and CSS generation.
- `src/ui/` contains popup, developer tools, options, and shared controls.
- `src/api/` builds the consumable JavaScript API.
- `src/config/` contains site lists and per-site fixes.
- `src/utils/` contains shared utilities.
- `tasks/` contains the custom build and maintenance tooling.
- `tests/unit/`, `tests/browser/`, and `tests/inject/` are the main test suites.

Build output is written under `build/` and must not be edited by hand.

## Setup and Common Commands

Use a current Node.js LTS release. From the repository root:

```bash
npm install
npm run debug                 # Build debug Chrome and Firefox extensions
npm run debug:watch           # Rebuild debug extensions on changes
npm run build                 # Create release packages
npm run api                   # Build darkreader.js and darkreader.mjs
npm run build -- --help       # Show custom build flags
```

Load `build/debug/chrome` as an unpacked Chromium extension. For Firefox, load
`build/debug/firefox/manifest.json` as a temporary add-on.

## Verification

Run the narrowest useful check while iterating, then expand verification in
proportion to the change:

```bash
npm test                      # Unit tests (default)
npm run test:coverage         # Unit tests with coverage
npm run test:browser          # Chrome MV2/MV3 and Firefox browser tests
npm run test:inject           # Karma injection tests
npm run test:all              # Unit, browser, and injection suites
npm run lint                  # ESLint for source, tasks, tests, and declarations
npm run release               # Unit tests, lint, and release build
```

Browser and injection suites require suitable local browsers. Test files
normally use the `*.tests.ts` suffix. Add focused tests near the behavior being
changed and report any suite that could not run.

## Code and Configuration Conventions

- Follow `eslint.config.js`: four-space indentation, single quotes, semicolons,
  and no spaces inside object braces.
- Preserve existing module boundaries. ESLint restricts imports between
  background, inject, UI, generator, API, and test layers.
- Prefer small, single-purpose changes. Do not add dependencies, change the
  build process, or modify `package.json`/`package-lock.json` unless the user
  explicitly authorizes a fork-specific departure.
- Keep entries in `src/config/*.config` alphabetized. Use short, targeted CSS
  selectors and preserve the surrounding rule syntax and formatting.
- For site fixes, verify both light and dark behavior and use Dark Reader color
  variables instead of hard-coded colors where appropriate.
- Do not edit generated bundles (`build/`, `darkreader.js`, or
  `darkreader.mjs`) directly.

## Fork and Upstream Workflow

- Keep fork-specific behavior clearly separated from upstream-compatible
  changes.
- Fetch canonical changes with `git fetch upstream`; do not rewrite unrelated
  user changes while resolving drift.
- The upstream project requires prior discussion for substantial feature or
  bug work, limits pull requests to one purpose, forbids dependency/build
  manifest changes, and does not accept predominantly AI-generated code. Read
  `CONTRIBUTING.md` before preparing anything intended for upstream.
- Never assume a fork change should be sent upstream. Ask before creating an
  upstream-facing branch, issue, or pull request.
