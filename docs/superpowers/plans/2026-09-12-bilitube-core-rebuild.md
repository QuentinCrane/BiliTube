# BiliTube Core Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Deliver a clean BiliTube core extension that deeply supports Home, Watch, Space, Video Search, and History while keeping all other Bilibili routes native and never moving the native player.

**Architecture:** A route-policy module selects replace/decorate/passthrough. Replace routes use one persistent shell and a reversible visibility guard; watch pages use a separate non-destructive decorator. A MAIN-world bridge supplies normalized data and preview media with caching.

**Tech Stack:** Manifest V3, vanilla JavaScript, CSS custom properties, DOM APIs, Node 22 built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-12-bilitube-core-rebuild-design.md`

## Global Constraints

- Do not move, clone, or replace the native Bilibili player.
- Do not move native page regions into `#bilitube-root`.
- Unsupported routes must be clean passthrough.
- Theme switching must not remount route content.
- Hover preview must allow only one active media element and must be seekable.
- No npm/build step is required for installation.

---

### Task 1: Core route policy, theme, cache, and preview math

**Files:**
- Create: `src/core/policy.js`
- Create: `src/core/theme.js`
- Create: `src/core/cache.js`
- Create: `src/core/preview-model.js`
- Test: `tests/core.test.js`

**Interfaces:**
- Produces: `BiliTubePolicy.resolve(locationLike) -> { route, strategy }`
- Produces: `BiliTubeTheme.resolve(preference, systemDark) -> 'light'|'dark'`
- Produces: `BiliTubeCache.createCache(nowFn)` with `get`, `set`, `remember`
- Produces: `BiliTubePreviewModel.seekTime(clientX, left, width, duration)` and session state reducer

- [x] Write failing tests for route strategy, theme resolution, TTL expiry/deduplication, seek clamping, and one-active-session policy.
- [x] Run `node --test tests/core.test.js` and verify failures are due to missing modules.
- [x] Implement the four pure modules minimally.
- [x] Run `node --test tests/core.test.js` and verify PASS.

### Task 2: Data normalization and MAIN-world bridge

**Files:**
- Create: `src/core/data.js`
- Create: `src/page/bridge.js`
- Test: `tests/data.test.js`

**Interfaces:**
- Consumes: `BiliTubeCache`
- Produces: normalized home cards, history cards, space profile/archive cards, subscription items.
- Produces bridge messages with `source: 'bilitube-bridge-core'`.

- [x] Write failing normalization tests with representative Bilibili payload fixtures.
- [x] Run `node --test tests/data.test.js` and verify RED.
- [x] Implement normalizers.
- [x] Run tests and verify GREEN.
- [x] Implement bridge request/caching/navigation observation using only tested normalizers and cache behavior.

### Task 3: Persistent replace-route shell and reversible native visibility

**Files:**
- Create: `src/core/native-visibility.js`
- Create: `src/core/ui.js`
- Create: `src/core/shell.js`
- Create: `src/styles/core.css`
- Test: `tests/static-contract.test.js`

**Interfaces:**
- Produces: `NativeVisibilityGuard.hide(root)` / `restore()` without node movement.
- Produces: `ShellController.ensure()`, `render(route,data)`, `updateTheme(theme)`, `destroy()`.

- [x] Write static contract tests that reject `appendChild(player)`, `bilitube-player-slot`, and native-region handoff patterns and require semantic theme tokens.
- [x] Run static contract test and verify RED.
- [x] Implement visibility guard, UI factory, persistent shell, and token-based CSS.
- [x] Run static tests and core tests and verify GREEN.

### Task 4: Home, history, search, and space surfaces

**Files:**
- Modify: `src/core/ui.js`
- Create: `src/core/preview.js`
- Create: `src/core/extract.js`
- Test: `tests/render-contract.test.js`

**Interfaces:**
- Consumes normalized card/profile data.
- Produces DOM factories for home/search/history/space and a single-session hover preview controller.

- [x] Write contract tests for exported surface renderer names and preview cleanup/seek hooks.
- [x] Run tests and verify RED.
- [x] Implement card/surface factories and extractors.
- [x] Implement delayed single preview with range seek control and full cleanup.
- [x] Run tests and verify GREEN.

### Task 5: Non-destructive Watch decorator

**Files:**
- Create: `src/core/watch.js`
- Create: `src/core/actions.js`
- Modify: `src/styles/core.css`
- Test: `tests/watch-contract.test.js`

**Interfaces:**
- Produces: `WatchDecorator.mount(data, callbacks)` / `destroy()`.
- Produces: native action target discovery/proxy functions.

- [x] Write contract tests requiring no player reparenting and requiring bounded readiness retry/action fallback.
- [x] Run tests and verify RED.
- [x] Implement watch decorator around the existing player wrapper only.
- [x] Implement native action proxy with no fake-success state.
- [x] Run tests and verify GREEN.

### Task 6: Application lifecycle, manifest, options, and packaging

**Files:**
- Create: `src/core/app.js`
- Create: `src/page/preflight.js`
- Create: `src/styles/preflight.css`
- Create: `src/options/options.html`
- Create: `src/options/options.js`
- Create: `src/options/options.css`
- Create: `manifest.json`
- Create: `scripts/verify.mjs`
- Create: `README.md`
- Create: `CHANGELOG.md`

**Interfaces:**
- App chooses policy strategy, cancels stale loads, and guarantees passthrough restoration.

- [x] Write/extend static tests for manifest order and required files.
- [x] Run tests and verify RED.
- [x] Implement lifecycle with generation tokens and limited MutationObserver use.
- [x] Implement preflight only for replace routes.
- [x] Add options without route remount coupling.
- [x] Add manifest and verification script.
- [x] Run `node --test tests/*.test.js` and `node scripts/verify.mjs`.
- [x] Zip the folder so `manifest.json` is directly inside `BiliTube-Edge-Core/`.
