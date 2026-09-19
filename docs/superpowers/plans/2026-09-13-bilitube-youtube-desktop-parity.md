# BiliTube v0.11.0 YouTube Desktop Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild BiliTube around a single YouTube Desktop visual system while replacing the fragile v0.10.x watch-page handoff architecture with a native-first, in-place Bilibili watch decorator.

**Architecture:** Replace routes use the existing persistent BiliTube shell, but shared chrome, cards, spacing, and library/search/channel/history surfaces are normalized to one YouTube-like design system. Ordinary video pages keep Bilibili's player, title/info, creator/follow, toolbar, description, comments, and native recommendation nodes in their original parents; BiliTube marks and styles them in place and only observes native player modes. Adapt routes receive the same header and overlay drawer without moving native content.

**Tech Stack:** Manifest V3, vanilla JavaScript, CSS custom properties, DOM APIs, Bilibili same-site APIs for BiliTube-owned controls only, Node 22 built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-13-bilitube-youtube-desktop-parity-design.md`

## Global Constraints

- Never move, clone, or replace Bilibili's native player.
- Never move, clone, or replace the native watch toolbar, creator/follow module, description module, comment root, or native recommendation business module.
- Never synthesize pointer/click events for native watch interactions.
- Ordinary links remain plain `<a href>` navigation.
- Comments on ordinary watch pages remain entirely Bilibili-owned and unmodified internally.
- Wide/web/browser fullscreen modes release BiliTube normal-mode geometry instead of fighting Bilibili.
- BiliTube-created video cards retain Hover Preview and the top-right Watch Later action.
- All visible settings must be wired to runtime behavior.
- Final release requires full automated verification plus an explicit manual Edge+Bilibili acceptance checklist.

---

### Task 1: Freeze v0.10.x failure patterns with v0.11.0 contracts

**Files:**
- Create: `tests/regression-0110-native-first-watch.test.js`
- Create: `tests/regression-0110-youtube-parity.test.js`
- Modify: legacy watch tests only where they enforce superseded node-moving behavior.

**Interfaces:**
- Produces contract assertions for native-first watch, chrome metrics, shared page geometry, Hover Watch Later, and settings wiring.

- [ ] **Step 1: Write failing watch contracts** asserting `watch.js` contains no native slot creation, placeholder-based movement, comment hydration relocation, React event bridge, or synthetic action dispatch; native watch modules are only discovered/marked in place.
- [ ] **Step 2: Write failing visual contracts** for 56px header, 240px expanded sidebar, 72px compact sidebar, 12px media radius, shared chips/pills, native recommendation decoration, and page-specific layout classes.
- [ ] **Step 3: Run** `node --test tests/regression-0110-native-first-watch.test.js tests/regression-0110-youtube-parity.test.js` and verify failures are caused by v0.10.3 behavior.

### Task 2: Replace Watch architecture with an in-place native decorator

**Files:**
- Rewrite: `src/core/watch.js`
- Modify: `src/core/app.js`
- Modify: `src/core/native-adapter.js`
- Modify: `src/styles/core.css`
- Test: `tests/regression-0110-native-first-watch.test.js`

**Interfaces:**
- Produces `WatchDecorator.mount(data, callbacks)`, `updateContext`, `updateChrome`, `toggleSidebar`, `destroy` without native node movement.
- Adds semantic marker classes such as `bt-native-watch-player-host`, `bt-native-watch-info`, `bt-native-watch-up`, `bt-native-watch-toolbar`, `bt-native-watch-description`, `bt-native-watch-comments`, and `bt-native-watch-related` in place.

- [ ] **Step 1: Remove v0.10.x slot/move/restore/React-bridge code** from `watch.js` and its CSS.
- [ ] **Step 2: Implement bounded native-region discovery** with selector arrays and fail-open marking only; do not hide an uncertain region.
- [ ] **Step 3: Observe SPA replacement and player `data-screen` changes** with narrow MutationObservers; set root classes for normal/wide/web/mini/fullscreen states.
- [ ] **Step 4: Keep only BiliTube topbar + overlay sidebar as independent watch-page DOM.**
- [ ] **Step 5: Implement CSS-first in-place styling** for player container, native info/UP/toolbar/description/comments, and native related cards.
- [ ] **Step 6: Run** `node --test tests/regression-0110-native-first-watch.test.js` and make it green.

### Task 3: Normalize global YouTube Desktop chrome and tokens

**Files:**
- Modify: `src/core/ui.js`
- Modify: `src/core/shell.js`
- Modify: `src/core/native-adapter.js`
- Modify: `src/styles/core.css`
- Modify: `src/styles/preflight.css`
- Test: `tests/regression-0110-youtube-parity.test.js`

**Interfaces:**
- Header: 56px fixed chrome.
- Sidebar: 240px expanded, 72px compact, 240px overlay drawer.
- Shared topic chip, pill, divider, focus-visible, light/dark tokens.

- [ ] **Step 1: Rebuild topbar spacing and search geometry** to the 56px YouTube Desktop rhythm while preserving Bilibili-backed actions.
- [ ] **Step 2: Rebuild sidebar groups** with YouTube item heights, subtle group dividers, compact mode, and transient thin scroll thumb.
- [ ] **Step 3: Make adapt/watch drawers reuse the exact same sidebar component and metrics.**
- [ ] **Step 4: Add responsive/reduced-motion rules** and ensure closed backdrops have no hit testing.
- [ ] **Step 5: Run** the YouTube parity contract tests.

### Task 4: Standardize cards, Hover Preview, and Watch Later

**Files:**
- Modify: `src/core/ui.js`
- Modify: `src/core/preview.js`
- Modify: `src/core/app.js`
- Modify: `src/core/data.js`
- Modify: `src/styles/core.css`
- Test: `tests/regression-0110-youtube-parity.test.js`

**Interfaces:**
- Shared video-card media geometry and creator/meta row.
- `callbacks.toggleWatchLater(item)` remains the only card overlay action that prevents navigation.

- [ ] **Step 1: Write/adjust failing card assertions** for 16:9 media, 12px radius, two-line title, creator/meta hierarchy, preview overlay click-through, and top-right Watch Later clock.
- [ ] **Step 2: Refactor Home/Search/Space grids to reuse the same video-card structure** instead of route-specific near-duplicates.
- [ ] **Step 3: Preserve one active Hover Preview session** and ensure only the seek rail + Watch Later button accept pointer input over media.
- [ ] **Step 4: Keep Watch Later state backed by Bilibili list/add/del endpoints and update all matching cards in place.**
- [ ] **Step 5: Run preview/card tests and full relevant regression tests.**

### Task 5: Rebuild Home and Search to YouTube page composition

**Files:**
- Modify: `src/core/ui.js`
- Modify: `src/core/data.js`
- Modify: `src/core/app.js`
- Modify: `src/styles/core.css`
- Test: `tests/regression-0110-youtube-parity.test.js`

**Interfaces:**
- Home: topic chip row + responsive recommendation grid + Bilibili shelves.
- Search: official combined ordering, at most one channel card on All, full creator list only on User tab.

- [ ] **Step 1: Rebuild Home spacing/grid breakpoints** around YouTube's content density and keep special Bilibili shelves visually consistent.
- [ ] **Step 2: Rebuild Search horizontal rows** with large thumbnail, creator/meta, description and Hover actions.
- [ ] **Step 3: Enforce one best creator result on All** while preserving full User tab results.
- [ ] **Step 4: Keep search suggestions anchored to the header search field and keyboard accessible.**
- [ ] **Step 5: Run search/home regressions.**

### Task 6: Rebuild Channel, History, Watch Later, and Favorites surfaces

**Files:**
- Modify: `src/core/ui.js`
- Modify: `src/core/app.js`
- Modify: `src/styles/core.css`
- Test: `tests/regression-0110-youtube-parity.test.js`

**Interfaces:**
- Channel: banner/header/tabs/grid.
- History: grouped list + management column.
- Watch Later / Favorites: playlist/library summary + video list/grid.

- [ ] **Step 1: Rebuild Space header** to YouTube channel proportions and make tabs visually consistent across home/upload/dynamic/collections/favorites links.
- [ ] **Step 2: Rebuild History** with a narrow right management rail and denser horizontal rows.
- [ ] **Step 3: Rebuild Watch Later** as a playlist-style summary + ordered list while preserving Bilibili progress.
- [ ] **Step 4: Rebuild Favorites** around selected-folder summary + playlist/library structure.
- [ ] **Step 5: Run route render contracts.**

### Task 7: Adapt-route continuity and settings cleanup

**Files:**
- Modify: `src/core/native-adapter.js`
- Modify: `src/options/options.html`
- Modify: `src/options/options.js`
- Modify: `src/options/options.css`
- Modify: `src/core/app.js`
- Modify: `src/styles/core.css`
- Test: `tests/regression-0110-youtube-parity.test.js`

**Interfaces:**
- Adapt routes share header/drawer/theme without moving native business content.
- Settings groups map directly to persisted `bilitubeCoreSettings` values.

- [ ] **Step 1: Normalize Adapt chrome** for message/live/bangumi/course/account/creator/native routes and guarantee the menu drawer opens everywhere BiliTube is enabled.
- [ ] **Step 2: Recompose Options into Appearance/Home/Playback/Search/Content/Navigation groups.**
- [ ] **Step 3: Verify every option is read by runtime code** and remove any dead checkbox.
- [ ] **Step 4: Run options/adapt contracts.**

### Task 8: Release audit and packaging

**Files:**
- Modify: `manifest.json`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `PAGE_AUDIT.md`
- Modify: `scripts/verify.mjs` only if new contract checks are required.

**Interfaces:**
- Release version: `0.11.0`.

- [ ] **Step 1: Run full automated suite:** `node --test tests/*.test.js`.
- [ ] **Step 2: Run release verifier:** `node scripts/verify.mjs`.
- [ ] **Step 3: Update docs/version only after behavior tests are green.**
- [ ] **Step 4: Zip `BiliTube-Edge-v0.11.0` with `manifest.json` at the extension root.**
- [ ] **Step 5: Extract the final ZIP to a fresh directory and rerun the full tests and verifier there.**
- [ ] **Step 6: Diff source vs extracted package and compute SHA-256.**
- [ ] **Step 7: Publish a manual Edge+Bilibili acceptance checklist that explicitly marks live-runtime verification as pending until tested by the user.**
