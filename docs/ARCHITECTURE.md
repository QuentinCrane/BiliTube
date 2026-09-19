# BiliTube Architecture

本文面向希望阅读、修改或维护 BiliTube 的开发者。BiliTube 是一个不经过 bundler 的 Manifest V3 扩展，运行时由浏览器按照 `manifest.json` 中的顺序加载源码文件。

## Design principles

### Visual layer, not a second Bilibili

BiliTube owns the outer shell, page composition, theme tokens, card presentation and a small number of convenience actions. Bilibili continues to own the player, comments, native toolbar, business popovers and complex page data.

### Native-first on Watch

普通 `/video/BV...` 页面使用 `decorate` 策略。运行时只发现并标记 Bilibili 已经创建的区域，再通过 CSS 调整外层几何；不移动、克隆或替换播放器、原生 toolbar、简介、评论和相关推荐。

### Real browser navigation

由 BiliTube 创建的普通卡片、侧栏、搜索 Tab、频道 Tab 和收藏夹入口使用真实 `<a href>`。不要把普通导航改造成 `preventDefault → postMessage → location.assign` 的跳转链。

### Explicit fallbacks

路由策略、数据请求和页面挂载都应该有失败边界。接口失败时保留已有内容或返回 Bilibili 原生页面，不能因为视觉层异常而让用户失去播放器、评论或页面主体。

## Runtime layers

```text
manifest.json
├── page/bridge.js                 MAIN world: observe SPA navigation and native state
├── page/preflight.js               document_start: reserve Watch geometry early
├── styles/preflight.css            early route/watch geometry
├── styles/core.css                 theme tokens and page/watch decoration
├── core/policy.js                  URL -> route + strategy
├── core/theme.js                   theme resolution
├── core/cache.js                   in-memory request cache helpers
├── core/preview-model.js           preview seek math
├── core/api-client.js              content -> service worker message client
├── core/data.js                    Bilibili payload normalization
├── core/native-visibility.js       hide/restore guard for managed native pages
├── core/extract.js                 bounded DOM fallback extraction
├── core/preview.js                 one-card Hover Preview lifecycle
├── core/ui.js                      DOM factories and page renderers
├── core/shell.js                   persistent BiliTube shell and route outlet
├── core/native-adapter.js          outer adaptation for complex native pages
├── core/actions.js                 small action registry
├── core/watch.js                   native Watch discovery and decoration
└── core/app.js                     runtime state, route mount and API orchestration

background.js                       Manifest V3 service worker and Bilibili API calls
options/options.html                settings surface
options/options.js                  chrome.storage.local persistence
```

## Load and mount lifecycle

1. `bridge.js` is injected in the MAIN world at `document_start` so it can observe Bilibili's route changes and native page state without replacing business handlers.
2. `preflight.js` applies the earliest safe Watch geometry for ordinary video pages. The page does not wait for the full core runtime before reserving the final two-column shape.
3. The core modules are loaded in `manifest.json` dependency order.
4. `policy.resolve(location)` returns a route and one of `replace`, `decorate`, `adapt` or `passthrough`.
5. `app.js` increments a route generation, aborts the previous lifecycle, applies the theme, mounts the selected strategy and starts the relevant Bilibili requests.
6. A `replace` page uses `shell.ensure()` once and renders its route into the persistent outlet. `decorate` and `adapt` keep the native page in place and add only the required outer layer.
7. Navigation and settings changes repeat the lifecycle. Late API responses are ignored when their generation, URL or request sequence no longer matches the active page.

The important boundary is that “render again” must not mean “let old observers and async responses continue to own the removed DOM”. Every Shell render calls the `beforeRender` callback, which releases Hover Preview bindings before the outlet is replaced.

## Route strategies

| Strategy | Owner of business DOM | BiliTube behavior | Examples |
| --- | --- | --- | --- |
| `replace` | BiliTube route Shell plus Bilibili API payloads | Builds a full YouTube-like page, with native links | Home, Search, Dynamic, Watch Later, Favorites, Space |
| `decorate` | Bilibili | Marks native Watch regions and adds outer geometry/CSS | Ordinary video page |
| `adapt` | Bilibili | Adds shared Header/Drawer/Theme and scoped page styling | History, Live, Bangumi, Account, Creator |
| `passthrough` | Bilibili | Removes BiliTube state and does not take over the page | Native escape and unsupported hosts |

The route policy is deliberately conservative. New routes should be added only after deciding which DOM owner is safe for the page's core interactions.

## API and data flow

```text
content script (app.js)
        │ chrome.runtime.sendMessage({ source: "bilitube-api", type, params })
        ▼
background service worker (background.js)
        │ WBI signing / cache / credentials: include
        ▼
Bilibili API endpoints
        │ raw payload
        ▼
background response -> Data.normalize* -> app state -> UI renderer
```

The service worker owns network calls so the page-world runtime does not directly depend on Bilibili CORS behavior. WBI-capable requests prefer the signed endpoint and keep a legacy endpoint fallback where the implementation provides one. Short-lived responses are cached in memory to avoid duplicate requests while a page is active.

The content runtime treats normalized data as the UI contract. Renderers should not reach into raw Bilibili response shapes or assume that one API field is always present.

## Shell and DOM ownership

`core/shell.js` creates one `#bilitube-root` with three stable regions:

```text
#bilitube-root
├── [data-role="header"]  persistent BiliTube top bar
└── .bt-body
    ├── [data-role="sidebar"] persistent desktop navigation
    └── #bilitube-outlet    replace-route content outlet
```

The Header is updated in place so an in-progress search draft is not lost merely because account or subscription data arrives. The Sidebar can be rebuilt when its subscription content changes, but its collapsed state is carried forward. Watch and Adapt pages use the same Header and an overlay drawer instead of inserting a second full page Shell.

## Native-first Watch boundary

`core/watch.js` discovers the native left and right columns, player, title/info, toolbar, description, comments and recommendation roots. It adds semantic markers and a simple author mirror, then observes only the Watch layout and player state that can legitimately change.

The following are deliberately outside BiliTube ownership:

- Bilibili player element and player controls.
- Bilibili title/business information that owns its own events.
- `#arc_toolbar_report` / native toolbar and its popovers.
- Bilibili description and comment roots, including comment Shadow DOM.
- Native related-video cards and their anchor elements.

The CSS may change order, width, gap, radius and typography at the outer layout level. It must not use `display: contents` on the core left/right layout boxes, move native nodes to synthetic slots, or synthesize click/pointer events for native actions.

## Infinite loading and thumbnail stability

The current feed architecture keeps normalized items in arrays and re-renders the route when a page arrives. This makes the renderer simple, but it means image DOM nodes can be recreated. The progressive image pipeline in `core/ui.js` therefore has a runtime-only `imageLoadStates` map keyed by the full thumbnail URL.

```text
new thumbnail URL
  -> create <img class="is-loading is-preview">
  -> load/error event
  -> remember URL as settled
  -> remove blur/shimmer state

same URL during a later feed render
  -> create <img class="is-loaded">
  -> no visible blur reset
```

This map is intentionally not persisted. It is a visual continuity guard for the current page lifecycle, not a replacement for the browser HTTP cache or a media download store.

The same path also protects against two related races:

- `requestGeneration` and `requestHref` prevent a response from a previous route from changing the current page.
- `apiSeq` prevents an older request for the same logical feed key from winning after a newer request has started.

The regression is covered in `tests/interaction-state.test.js` by simulating a settled thumbnail, creating the same card after a later render, and asserting that the new thumbnail is immediately `is-loaded` rather than `is-preview`.

## Preview lifecycle

There is at most one active Hover Preview session. `core/preview.js` owns:

- delayed media lookup;
- one active video layer;
- IntersectionObserver offscreen tracking;
- seek rail events;
- pause, source cleanup and DOM removal;
- unbinding when a card or route disappears.

Normal thumbnail links remain clickable because the preview layer is pointer-transparent except for its own seek rail. `beforeRender` calls `preview.destroy()` before route content is removed so observers do not retain detached cards.

## Message boundaries

The main message channels are intentionally small:

| Source/type | Purpose |
| --- | --- |
| `bilitube-api` | Content runtime asks the service worker for Bilibili data |
| `bilitube-control` | Content runtime asks the service worker to open the options page |
| `bilitube-bridge-core` | MAIN-world bridge and isolated-world core exchange navigation/state/write results |

When adding a message, define its payload, failure response and lifecycle cancellation behavior. Do not add a broad page-world bridge for ordinary navigation or for native Watch interactions.

## Extension points for contributors

When adding a page capability:

1. Add or update the route policy first.
2. Decide whether the page should be `replace`, `decorate`, `adapt` or `passthrough`.
3. Put raw endpoint access in `background.js` and normalization in `core/data.js`.
4. Keep renderer input normalized and preserve real URLs in the resulting DOM.
5. Add a static contract or lifecycle regression test before changing the renderer.
6. Add the page and its manual checks to `PAGE_AUDIT.md`.
7. Test route changes, late responses, extension disable/restore and reduced-motion mode.

## Known architectural risks

- Bilibili can rename DOM classes, change SPA navigation behavior or change API/WBI fields.
- Logged-out and logged-in responses have different shapes and permissions.
- CDN image URLs can expire or return a different format.
- A passing Node.js contract test cannot prove that the current production page still exposes the expected native DOM.

For these reasons, keep source changes narrow, preserve native ownership, and record real browser evidence separately from automated verification.
