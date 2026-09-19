# BiliTube v0.11.0 Native-first Watch Architecture Design

## Goal

Rebuild the ordinary Bilibili video watch page so that BiliTube keeps the YouTube-like visual language while Bilibili retains ownership of every fragile native capability: player lifecycle, like/coin/favorite/share interactions, follow state, description behavior, comments, wide mode, web fullscreen, browser fullscreen, and native related-video navigation.

The reset removes the v0.10.x strategy of moving Bilibili toolbar/comment nodes into BiliTube-created slots and removes the React event bridge required by that approach.

## Product Principle

BiliTube owns presentation and information architecture. Bilibili owns business interactions and stateful native widgets.

For ordinary `/video/...` pages:

- Never move or replace the Bilibili player.
- Never move or replace the Bilibili toolbar.
- Never move or replace the Bilibili comment root or anything inside its Shadow DOM.
- Never proxy normal video/UP/navigation links through a BiliTube bridge.
- Do not create duplicate like, coin, favorite, share, follow, or comment controls.
- Restyle/reflow native modules in place whenever possible.
- When a module cannot be safely restyled, leave it native rather than reimplementing it.

## Why v0.10.x Failed

The previous watch architecture created a parallel BiliTube metadata panel and physically moved native toolbar/comment modules into BiliTube slots. That caused three classes of failures:

1. Bilibili comments hydrate asynchronously. Moving a comment shell before hydration can race the site's renderer and leave the editor/list incomplete.
2. Bilibili toolbar interactions are partly delegated through the site's framework root. Moving the toolbar can detach it from the framework's delegated event path, requiring an incomplete event bridge.
3. The custom watch panel and native page geometry competed for layout ownership, especially during wide mode and web fullscreen.

Open-source implementations we reviewed support the safer direction:

- BewlyCat contains extensive special handling for comment hydration and moved React event forwarding, showing that moving these modules is intrinsically high-risk.
- bilibili-cleaner keeps the native player/page containers and reorders or constrains layout through CSS rather than rebuilding player behavior.
- Bilibili-Evolved keeps standard navigation and uses native endpoints only for isolated actions such as Watch Later.

## Scope

### In scope

- Ordinary Bilibili video detail pages (`www.bilibili.com/video/...`).
- Native player layout compatibility.
- Native title/UP/follow/toolbar/description/comments styling and placement.
- Right-side recommendation styling and clickability.
- Wide mode, web fullscreen, browser fullscreen, mini-player coexistence.
- BiliTube top bar and overlay sidebar on the watch page.
- Hover preview and Watch Later shortcut on BiliTube-created video cards elsewhere.
- Theme compatibility for watch-page outer surfaces.

### Out of scope

- Reimplementing Bilibili comments.
- Reimplementing like/coin/favorite/share dialogs.
- Replacing the Bilibili player.
- Moving native watch-page business modules to a BiliTube-owned root.
- Rebuilding bangumi/course/live watch pages in this reset; they keep their existing Adapt strategy.

## Watch Page Architecture

### 1. Native DOM is authoritative

BiliTube will discover stable native regions and add semantic marker classes only:

- player host: `#playerWrap`, `#bilibili-player`, `#bilibiliPlayer`, `.bpx-player-container`
- title/info host: `.video-info-container`, `#viewbox_report`, relevant current title container
- UP host: `.up-panel-container`, `.up-info-container`
- toolbar host: `#arc_toolbar_report`, `.video-toolbar-container`
- description host: `#v_desc`, `.video-desc-container`
- comments host: `#comment-module`, `#comment-body`, `#commentapp`, modern comment root candidates
- recommendations host: `.right-container` / current native recommendation list candidates

Marker classes are added in place, for example `bt-native-watch-toolbar`, but the node's parent is never changed.

The decorator must not create toolbar/comment slots and must not store placeholders for native nodes.

### 2. Layout is CSS-first

The native left content column becomes a flex column in normal mode. The player is visually first without changing its parent or rebuilding its DOM.

Conceptual order:

```text
Native player
Native video title/info
Native UP/follow row
Native toolbar
Native description
Native comments
```

BiliTube CSS converts these native regions toward YouTube Desktop styling:

- restrained title typography and spacing;
- UP avatar/name/follow row resembling a YouTube channel row;
- native action toolbar presented as rounded YouTube-style controls without hiding the real hit targets;
- description presented as a soft surface/card while preserving native expand/collapse behavior;
- comments retain Bilibili's renderer, editor, sorting, pagination, and Shadow DOM untouched.

No CSS rule may set `pointer-events:none` on a native interactive watch module or its ancestor.

### 3. Related videos stay native-first

Preferred strategy: decorate the native Bilibili related-video list in place. Native anchors remain native anchors.

Only if the current page has no usable native recommendation region may BiliTube show its own fallback list. The fallback list uses plain `<a href>` links and no navigation interception.

This removes the v0.10.x duplicate/independent related column as the default path.

### 4. BiliTube chrome remains separate

The BiliTube top bar remains a small independent fixed layer. The left navigation on watch pages remains an overlay drawer opened from the menu button.

The BiliTube chrome must not create an invisible full-page hit layer. Backdrop hit testing exists only while the drawer is open.

## Player Modes

### Normal

BiliTube may apply the YouTube-like desktop two-column page proportions to the native page containers, while preserving the native player's own internal geometry.

### Wide mode

Wide mode is detected from Bilibili's own player state (`data-screen="wide"`, current entered button state, and compatible fallbacks).

While wide mode is active:

- remove normal-mode width/max-width/grid constraints that limit the player;
- let Bilibili determine player dimensions;
- keep metadata/comments in normal document flow below the player;
- avoid duplicated/floating BiliTube recommendations that compete with the player width.

BiliTube does not synthesize a second wide mode and does not programmatically click the wide button.

### Web fullscreen

When Bilibili enters web fullscreen (`data-screen="web"` or equivalent):

- BiliTube top bar and drawer chrome are visually suppressed;
- normal watch-page layout constraints are released;
- the player owns the viewport;
- metadata, comments, and recommendations remain in the DOM but do not overlay the viewport.

When web fullscreen exits, normal styling resumes from native state observation.

### Browser fullscreen

BiliTube relies on native fullscreen behavior. It only ensures its fixed chrome does not overlay `document.fullscreenElement`.

## Comments Contract

Comments are completely native.

BiliTube may style only the outer light-DOM container if necessary for spacing/width. It must not:

- move the comment root;
- query and manipulate comment Shadow DOM content;
- inject a BiliTube comment editor;
- request comment-list APIs for ordinary rendering;
- replace Bilibili sorting/pagination/replies;
- add hydration timing logic whose purpose is to relocate the comments.

If comments fail to render, BiliTube must prefer releasing its watch-page layout CSS over creating a substitute renderer.

## Interaction Contract

Like, coin, favorite, share, follow, triple-like, description expand/collapse, comment actions, and native menus are activated by clicking Bilibili's real DOM controls.

BiliTube does not dispatch synthetic click/pointer sequences for these controls and does not bridge React handlers for them.

The extension may still call Bilibili APIs for isolated BiliTube-owned controls elsewhere, such as the Hover Watch Later shortcut, because those controls do not have an equivalent native element being restyled in place.

## Hover Preview and Watch Later

BiliTube-created video cards keep YouTube-like Hover Preview:

- preview overlays the thumbnail without intercepting the card's normal navigation;
- bottom progress indicator is embedded in the thumbnail;
- only the progress interaction region captures pointer input;
- Hover reveals a top-right Watch Later clock action;
- the Watch Later button stops propagation and prevents link navigation only for that button;
- it uses Bilibili's real Watch Later list/add/remove endpoints and reflects added/not-added state.

## Theme

Watch-page native regions are themed through outer variables and carefully scoped light-DOM rules. BiliTube does not force theme styling into comment Shadow DOM.

Theme changes update root tokens first, then outer watch surfaces, to avoid staggered transitions.

## Failure Handling

The watch decorator is fail-open:

- If required native regions cannot be identified, do not hide them.
- If a selector is uncertain after a Bilibili rollout, skip styling that region rather than replacing it.
- If player mode detection is uncertain, release BiliTube geometry constraints.
- If the BiliTube top bar/sidebar fails, native page navigation must remain usable.

## Code Structure

### `src/core/watch.js`

Reduce to a native marker/state decorator. Responsibilities:

- locate native watch regions;
- add/remove semantic marker classes;
- observe SPA replacement of those regions;
- observe native player mode state;
- mount/unmount only BiliTube chrome (top bar + overlay drawer);
- never create metadata, toolbar, comments, or related-video replacement panels as the primary path.

### `src/styles/core.css`

Own the YouTube-like watch presentation using marker classes and native containers. Separate normal/wide/web-fullscreen rules clearly.

### `src/page/bridge.js`

Remove watch-specific React event forwarding introduced solely for moved native modules. Retain unrelated bridge behavior still needed by other extension features.

### `src/core/actions.js`

Remove watch-page synthetic native-interaction routing if no longer used. Keep only actions required by BiliTube-owned controls elsewhere.

### `src/core/app.js`

Watch route still uses Decorate strategy, but supplies only chrome/theme/settings data to the watch decorator. Native watch metadata/action rendering callbacks are no longer required.

### Tests

Create v0.11 regression tests that assert architecture rather than old implementation details.

## Verification Requirements

Automated tests must verify at minimum:

1. `watch.js` contains no native toolbar/comment node relocation (`appendChild`, `insertAdjacentElement`, placeholder restore logic for those modules).
2. `watch.js` contains no synthetic toolbar action invocation or React event bridge registration.
3. Native toolbar/comment selectors are used only for in-place discovery/marking.
4. CSS does not disable pointer events for native watch interaction regions.
5. Normal mode uses native container ordering/styling without moving the player.
6. Wide mode releases normal player constraints.
7. Web fullscreen suppresses BiliTube chrome and releases normal geometry.
8. Native recommendation anchors remain directly clickable.
9. Hover Preview layer does not block card links.
10. Hover Watch Later button is the only card-overlay control that prevents navigation.
11. Existing home/search/history/favorites/sidebar/settings tests continue to pass.

## Manual Acceptance Checklist

A real Edge + Bilibili logged-in session remains mandatory for final acceptance because DOM-contract tests cannot prove Bilibili's production framework behavior.

On one ordinary video page test, in order:

1. video plays and controls work;
2. like toggles;
3. coin dialog opens;
4. favorite dialog opens;
5. share menu opens;
6. follow toggles;
7. description expands/collapses;
8. comments visibly load;
9. comment editor accepts focus/text;
10. comment sorting/replies remain usable;
11. right-side recommendation opens normally;
12. Ctrl/middle-click opens a recommendation in a new tab;
13. wide mode enters/exits correctly;
14. web fullscreen enters/exits correctly;
15. browser fullscreen enters/exits correctly;
16. overlay Sidebar opens/closes without blocking the page after closing.

On a BiliTube-created video card test:

1. Hover Preview plays;
2. progress interaction works;
3. card remains clickable;
4. Watch Later clock appears on Hover;
5. Watch Later add/remove changes state without opening the video.

## Release Rule

v0.11.0 must not be presented as "fixed in production" based only on static/unit tests. Release notes must distinguish automated contract verification from real Edge/Bilibili manual acceptance.
