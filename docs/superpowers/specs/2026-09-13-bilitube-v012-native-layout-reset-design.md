# BiliTube v0.12.0 Native Layout Reset Design

## Goal

Make the two most visible broken surfaces—Watch and History—behave like YouTube Desktop without replacing Bilibili's own business logic. Watch keeps native Bilibili player, title, creator, toolbar, description, comments, and recommendations in their original DOM ownership while visually reflowing them into a YouTube-style two-column layout. History stops depending on BiliTube's custom history API renderer and instead keeps Bilibili's native history page alive, with BiliTube chrome and YouTube-inspired styling applied around it.

## Watch architecture

- Strategy remains `decorate` for `/video/BV...`.
- BiliTube MUST NOT move/reparent the player, toolbar, comments, creator panel, description, or recommendation DOM.
- `watch.js` only discovers native regions, assigns stable semantic marker classes, observes route/player mode changes, and renders BiliTube header/drawer.
- The native layout root is visually reflowed using CSS Grid/Flex and `display: contents` where necessary so DOM ownership remains unchanged.
- Desktop normal mode target:
  - page topbar 56px
  - content max width approximately 1800px with 24px horizontal gutters
  - main player/content column minmax(0, 1fr)
  - related column approximately 402px
  - 24px inter-column gap
  - player at 16:9, visually first in the main column
  - title below player, then creator/toolbar row, description, comments
  - related videos aligned with player top
- At <= 1120px related width reduces; at <= 900px layout becomes one column.
- Native comments stay untouched internally.

## Player visual treatment

- Preserve Bilibili's actual player and controls.
- Do not replace or emulate playback controls in JavaScript.
- Use current Bilibili BPX selectors only for visual sizing so the control bar reads closer to YouTube Desktop:
  - bottom controls around 48px visual height
  - compact 40px control hit areas
  - time text ~13px
  - progress rail thin at rest and enlarged on hover
  - rounded player corners 12px in normal mode
- Do not alter player interaction semantics.
- On `wide`, `web`, `mini`, or browser fullscreen, BiliTube normal-mode dimensions must yield to the native player state. Web/browser fullscreen hides BiliTube chrome.

## History architecture

- `/history` and `/account/history` change from `replace` to `adapt`.
- BiliTube no longer requests history API data for the primary history page.
- Native Bilibili history DOM remains responsible for authentication, pagination, search, clear-history, pause-history, delete-item and future site changes.
- `native-adapter.js` sets `data-bt-native-route="history"`; BiliTube header and overlay sidebar remain available.
- CSS supports both known current/legacy Bilibili history structures, including `.history-record`, `.history-wrap`, `.history-list`, `.b-head-search`, `.main-breadcrums`, `.r-info`, `.l-info`, `.cover-contain`.
- Visual target mirrors YouTube History: broad list left, management/search controls right where native structure allows, restrained typography, 16:9 thumbnails, red progress bar, generous white space.
- If Bilibili changes history markup, native content should remain visible and functional rather than being hidden by a failed BiliTube replacement.

## Existing capabilities preserved

- Global BiliTube topbar and sidebar/drawer.
- Home shelves, search, channel/space, favorites, watch later, dynamic, theme system.
- Video-card hover preview.
- Hover watch-later quick action.
- Native browser links stay real `<a href>` links.

## Non-goals

- Reimplementing comments.
- Reimplementing player controls.
- Reimplementing history APIs or history mutations.
- Pixel-copying YouTube icons inside the Bilibili player at the expense of native behavior.

## Acceptance criteria

1. Normal Watch shows player before title visually.
2. Watch normal mode uses a YouTube-like main + ~402px related column.
3. Player container is 16:9 in normal desktop mode and has 12px corners.
4. Native BPX controls remain clickable and are only visually resized.
5. Title, creator, native toolbar, description, comments remain in original DOM parentage.
6. Wide/web/fullscreen release BiliTube normal layout constraints.
7. `/history` and `/account/history` resolve to `adapt`, never `replace`.
8. Opening History does not require BiliTube history API success.
9. Native history controls remain available.
10. Existing Home/Search/Space/Watch Later/Favorites/Dynamic regressions remain green.
