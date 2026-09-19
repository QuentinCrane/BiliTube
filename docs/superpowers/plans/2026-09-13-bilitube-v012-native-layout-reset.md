# BiliTube v0.12.0 Native Layout Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Watch visual layout around native Bilibili DOM and convert History from fragile custom replacement to native-first adaptation while moving both surfaces closer to YouTube Desktop.

**Architecture:** Watch keeps strategy `decorate`; semantic marker classes plus CSS Grid/`display: contents` visually reorder native regions without reparenting them. History changes to `adapt` and relies on native Bilibili history DOM, with BiliTube header/drawer and route-specific YouTube-inspired CSS.

**Tech Stack:** Manifest V3, vanilla JavaScript, CSS, Node.js `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-13-bilitube-v012-native-layout-reset-design.md`

## Global Constraints

- Never move/reparent Bilibili player, toolbar, comments, creator panel, description, or related recommendation DOM.
- Never replace native comment or player-control behavior.
- Ordinary navigation remains browser-native `<a href>` navigation.
- History primary page must not depend on BiliTube history API calls.
- Preserve hover preview and hover watch-later quick action.

---

### Task 1: Lock Watch and History architecture with failing regression tests

**Files:**
- Create: `tests/regression-0120-native-layout-reset.test.js`
- Modify: `tests/core.test.js` only if old policy expectations conflict with approved design.

**Interfaces:**
- Consumes: `Policy.resolve(url)`, `src/core/watch.js`, `src/styles/core.css`, `src/core/app.js`.
- Produces: regression contract for native-first Watch and native-first History.

- [ ] Write tests asserting History is `adapt`, Watch CSS uses the YouTube-like grid dimensions and 16:9 player treatment, BPX controls are styled without being replaced, and the Watch module contains no DOM-moving primitives for native regions.
- [ ] Run `node --test tests/regression-0120-native-layout-reset.test.js` and confirm RED for v0.11.0 behavior.
- [ ] Change only implementation necessary for the tests.
- [ ] Re-run the test until GREEN.

### Task 2: Reflow Watch with native DOM ownership preserved

**Files:**
- Modify: `src/core/watch.js`
- Modify: `src/styles/core.css`

**Interfaces:**
- Consumes marker classes: `bt-watch-native-layout`, `bt-native-watch-main`, `bt-native-watch-player-host`, `bt-native-watch-info`, `bt-native-watch-up`, `bt-native-watch-toolbar`, `bt-native-watch-description`, `bt-native-watch-comments`, `bt-native-watch-related`.
- Produces: visual YouTube-style Watch layout while keeping all native nodes under their original parents.

- [ ] Add failing CSS/static assertions for player-first visual order and `display: contents` flattening of Bilibili layout wrappers.
- [ ] Run the focused test and confirm RED.
- [ ] Implement normal-mode grid: ~402px related column, 24px gap, max-width ~1800px, player-first layout, metadata below player.
- [ ] Add normal-mode 16:9 and player-control visual sizing using BPX selectors; do not intercept control events.
- [ ] Add responsive and wide/web/fullscreen escape rules.
- [ ] Re-run focused tests until GREEN.

### Task 3: Convert History to native-first adaptation

**Files:**
- Modify: `src/core/policy.js`
- Modify: `src/core/app.js`
- Modify: `src/styles/core.css`
- Test: `tests/regression-0120-native-layout-reset.test.js`

**Interfaces:**
- Consumes: native adapter route data attribute `data-bt-native-route="history"`.
- Produces: History page that renders from Bilibili's own DOM and remains functional if BiliTube history API fails.

- [ ] Add failing test asserting History route is `adapt` and `renderReplace()` no longer owns the primary History route.
- [ ] Run focused test and confirm RED.
- [ ] Change policy to `adapt`; remove the History branch from custom Replace rendering and infinite-load path used only by the primary history route.
- [ ] Keep legacy history helper functions only if still referenced elsewhere; otherwise remove dead state/API callbacks safely.
- [ ] Add route-specific native History CSS supporting `.history-record`, `.history-wrap`, `.history-list`, `.b-head-search`, `.main-breadcrums`, `.r-info`, `.l-info`, `.cover-contain`.
- [ ] Re-run focused tests until GREEN.

### Task 4: Full regression and release package

**Files:**
- Modify: `manifest.json`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `PAGE_AUDIT.md`

**Interfaces:**
- Produces: `BiliTube-Edge-v0.12.0.zip`.

- [ ] Update version/docs to 0.12.0 and state that Watch/History are native-first.
- [ ] Run `node --test tests/*.test.js` and require 0 failures.
- [ ] Run `node scripts/verify.mjs` and require success.
- [ ] Zip the extension, extract to a fresh directory, then rerun the entire test suite and `verify` from the extracted files.
- [ ] Run `diff -qr` between source and extracted package and require no differences.
- [ ] Compute SHA-256 for the final ZIP.
