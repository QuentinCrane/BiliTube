# BiliTube Core Rebuild Design

## Goal

Rebuild BiliTube as a stable daily-use Edge/Chromium extension that applies YouTube-like information architecture and interaction rhythm to Bilibili without moving or replacing Bilibili's native video player. Stability, consistent theming, and predictable fallback take priority over page coverage.

## Product Boundary

BiliTube is not a YouTube clone and not a CSS skin. Bilibili remains the source of account state, video playback, danmaku, quality selection, subtitles, speed, fullscreen, multipart playback, collections, coins, favorites, charging, following, comments, live content, and PGC content. BiliTube reorganizes information hierarchy and presentation.

This Core Rebuild deeply supports only the following routes:

- Home: full structured BiliTube replacement surface.
- Watch: non-destructive decoration around the native player; the player is never moved.
- Space home / uploads: structured channel surface backed by MID and native/API data.
- Video search: structured BiliTube search result surface.
- History: structured BiliTube history surface.

The following routes are deliberate passthrough in this core release: dynamic, favorites, watch later, messages, live, bangumi/film, creator center, account/settings, and unrecognized Bilibili pages. Passthrough means BiliTube removes its own shell and restores any hidden native nodes. It never wraps an unknown native page in a half-finished BiliTube container.

## Architecture

### Route strategy

Every location resolves to exactly one strategy:

- `replace`: BiliTube renders its own shell and hides native top-level visual children without moving them. Used by home, supported search, supported space pages, and history.
- `decorate`: BiliTube leaves native content in place and adds scoped interface pieces around it. Used by watch pages.
- `passthrough`: BiliTube removes itself completely and returns the page to Bilibili. Used everywhere else.

No native page region is appended into `#bilitube-root`.

### Persistent shell

`ShellController` owns one persistent root on `replace` routes. Header and sidebar are created once and updated in place. Route content is rendered only into an outlet. Theme changes mutate root attributes/classes only and never trigger route rendering.

### Native visibility guard

For `replace` routes, a `NativeVisibilityGuard` records the inline `display`, `visibility`, and `aria-hidden` state of body children and hides only visual top-level nodes. Script/style/link/noscript nodes are untouched. Restoring the route restores the exact recorded values. Native nodes are never moved, cloned, or destroyed.

### Watch decorator

The watch route never uses the visibility guard and never reparents the player or comments. It:

1. Finds a ready native Bilibili player.
2. Adds the BiliTube topbar as an independent fixed/sticky layer.
3. Adds one metadata/action panel adjacent to the existing player wrapper using `insertAdjacentElement`, not `appendChild` on the player.
4. Optionally hides a known duplicate native metadata block only when it can be positively identified; otherwise it leaves the native block visible rather than risking functionality.
5. Proxies action buttons to real Bilibili controls.

Fullscreen, theater mode, danmaku, HDR, quality, subtitles, speed, multipart switching, and codecs remain Bilibili-owned.

### Data bridge

A MAIN-world bridge performs same-site credentialed requests and observes Bilibili's own structured responses. It exposes only normalized data events through `window.postMessage`.

It supports:

- Home recommendation feed.
- Dynamic subscription navigation for sidebar presence/live signals.
- History cursor feed.
- Space profile by MID.
- Observation of native space archive requests.
- Hover preview media lookup.
- Navigation event forwarding.

Data responses are cached by key and TTL. Inflight requests with the same key are deduplicated.

### Hover preview

Only one preview session may exist at a time. A card starts a preview after 500 ms pointer hover. Preview uses one muted inline `<video>` plus a real seek control. Pointer/keyboard seeking updates `currentTime`. Leaving the card cancels timers, pauses the video, clears `src`, calls `load()`, and removes the element. Missing preview data leaves the thumbnail unchanged.

### Theme system

All BiliTube UI uses the following semantic tokens:

- `--bt-bg`
- `--bt-surface`
- `--bt-surface-hover`
- `--bt-text-primary`
- `--bt-text-secondary`
- `--bt-border`
- `--bt-chip`
- `--bt-accent`

`system`, `light`, and `dark` resolve to one `data-bt-theme` value. Switching theme is a single attribute update with a 200 ms color/background transition. No route remount is allowed.

### Rendering and performance

- Route changes update only the outlet or watch decorator.
- Data is cached in memory; cached data renders immediately.
- Missing data shows a small local placeholder, not a page-sized skeleton.
- Images use native lazy loading and async decoding.
- Home cards are observed with `IntersectionObserver`; preview media is never requested until hover.
- Every async route load owns an `AbortController`/generation token so stale responses cannot patch a newer route.
- Mutation observation is limited to route-critical anchors/player readiness and does not react to every subtree mutation.

## Information architecture

The replace-route shell contains:

- Header: menu, BiliTube brand, search, dynamic, messages, theme, account.
- Sidebar primary: 首页 / 动态 / 热门.
- Your content: 历史记录 / 稍后再看 / 收藏夹.
- Subscriptions: recent followed creators with unread/live indicators.
- Explore: 直播 / 番剧影视 / 知识 / 科技 / 游戏.
- More: 消息 / 大会员 / 设置.

Passthrough links are allowed and expected; clicking them must cleanly return to native Bilibili.

## Home

Home uses YouTube-like cards: thumbnail, duration, creator avatar, title, creator name, view/time metadata. Thumbnail opens video. Avatar/name open creator space. Category chips are derived from available Bilibili navigation data. Hover preview is silent, delayed, seekable, single-session, and disposable.

## Watch

The native player remains in place. BiliTube adds title, creator identity, follow, charge, like, coin, favorite, triple, share, and a compact description layer. Actions proxy real Bilibili controls. If proxy discovery fails, BiliTube must reveal/leave the native control rather than present a fake success state.

## Space

MID parsed from `space.bilibili.com/<mid>` is the canonical creator identity. Profile data must never be fabricated. Structured channel header contains banner when available, avatar, name, UID, stats, sign, and follow action. Tabs are real navigation links. Home/uploads show real archive items from captured native/API data; if archive data is unavailable, show a restrained loading/empty state rather than fake cards.

## Search

Only video/all search modes are structurally re-rendered in the core build. Other Bilibili search categories are passthrough. Results preserve thumbnail, title, creator, metadata, and creator link.

## History

History uses structured cursor data and shows day groups, thumbnails, title, creator, progress, part, and duration. Search is local to loaded history results. Destructive or state-changing history management controls are not reimplemented in the core release; links to native management are provided instead.

## Error handling and fallback

- Any exception during replace-route mount restores native visibility and removes BiliTube root.
- Any unsupported route is passthrough by policy, not by failure.
- Missing player on watch does not hide the page; the decorator retries with bounded backoff and then silently stops.
- API failure keeps existing cached/DOM data and does not blank the surface.
- No selector miss may trigger a whole-site fallback loop.

## Testing

Node's built-in `node:test` covers route policy, theme resolution, cache TTL behavior, data normalization, preview seek math/session policy, and fallback decisions. Static verification parses all scripts with Node, validates manifest references, ensures forbidden handoff patterns are absent, and checks that core CSS tokens exist.

Manual browser acceptance checklist:

- Home loads without visible Bilibili-to-BiliTube flash after first paint.
- Avatar/name and thumbnail navigate to different correct targets.
- Hover preview waits ~500 ms, seeks, and only one preview plays.
- Repeated light/dark switching remains synchronized and responsive.
- Watch player loads, danmaku/fullscreen/quality/subtitles/speed remain native and functional.
- Navigating home → watch → space → unsupported dynamic → home never leaves duplicate headers or hidden native body children.
- Unsupported pages look exactly like native Bilibili apart from extension-unrelated browser state.
