# BiliTube v0.11.0 YouTube Desktop Parity Design

## Goal

Rebuild BiliTube's visual system and route surfaces so the extension feels like one coherent YouTube Desktop product while Bilibili remains the source of content, playback, comments, account state, and native business interactions.

The target is not pixel-for-pixel copying of branding. The target is high structural and interaction parity: the same page hierarchy, spacing rhythm, responsive behavior, card proportions, control density, sidebar behavior, and watch-page composition that a YouTube Desktop user expects.

## Reference Baseline

The baseline is current YouTube Desktop as observed in 2026, plus the user's supplied watch-page screenshots. Because YouTube runs experiments, BiliTube uses the stable visual language rather than copying experimental variants:

- 56px desktop top bar.
- 240px expanded navigation rail, 72px compact rail, 240px overlay drawer on watch/adapt pages.
- White / #0f0f0f primary surfaces with #f2f2f2 / #272727 secondary fills.
- 12px media/card radius, 18px/20px pill controls, restrained 1px separators.
- Search centered in the header with a rounded left input and dedicated right submit segment.
- Home built around responsive 16:9 video cards and horizontal topic chips.
- Watch page built around a dominant native player, title/action/channel rows, compact description surface, native comments below, and a narrow recommendation column.
- Search built from large horizontal result rows with channel result(s) integrated into the result stream.
- Channel pages use banner -> avatar/name/stats/actions -> tabs -> shelves/grids.
- History uses a vertical history list with a right-side management/search column.
- Playlist/watch-later use a summary/playlist panel paired with an ordered video list.

## Product Boundary

BiliTube owns presentation, layout, chrome, and BiliTube-created card affordances. Bilibili owns playback, comments, like/coin/favorite/share/follow state, danmaku, quality, subtitles, native dialogs, and account/business logic.

For fragile native watch functionality, BiliTube must style in place rather than move, clone, or proxy native modules.

## Global Chrome

### Header

Desktop height: 56px. Fixed at the top.

Left group:
- 40x40 menu hit target.
- BiliTube wordmark area around 120px wide.

Center:
- search group max width 640px on large desktop;
- 40px height;
- input with 20px left radius;
- submit segment 64px wide with right radius;
- suggestions rendered directly under the input group;
- optional voice/search-extra controls are omitted unless backed by real Bilibili behavior.

Right group:
- dynamic, messages, theme, account/avatar with 40px hit targets;
- no decorative controls that do not map to Bilibili functionality.

### Sidebar

Expanded width: 240px. Compact width: 72px. Watch/adapt overlay drawer width: 240px.

Groups follow YouTube's visual cadence:
- primary;
- subscriptions;
- you/library;
- explore;
- more/settings.

Groups are separated by one subtle 1px divider. Items are 40px high with 12px horizontal padding and 10px radius. Active item uses the secondary fill and medium weight.

Scrollbar has no track/buttons and only exposes a narrow thumb while the user is scrolling.

## Shared Design Tokens

Light:
- background: #ffffff
- primary text: #0f0f0f
- secondary text: #606060
- hover/fill: #f2f2f2
- border: #e5e5e5
- strong chip: #0f0f0f with white text

Dark:
- background: #0f0f0f
- primary text: #f1f1f1
- secondary text: #aaaaaa
- hover/fill: #272727
- border: #3f3f3f
- strong chip: #f1f1f1 with #0f0f0f text

Typography uses the platform/system sans stack. Body 14px, metadata 12px, card titles 14-16px depending on surface, watch title 20px/28px, page headings 24-36px by context.

## Home

- Main content has 24px horizontal padding on desktop and responsive shrink below 1000px.
- Topic chips sit in a horizontally scrollable 48px row and use 32px high rounded pills.
- Standard video grid targets 3-4 columns on normal desktop, 2 columns on narrower windows.
- Cards use 16:9 media, 12px radius, creator avatar + text row, two-line title, creator, views/time metadata.
- Hover Preview stays inside the thumbnail and never blocks the card anchor.
- Hover shows a top-right Watch Later clock action.
- Bilibili-specific shelves (following/live/bangumi/popular) remain, but visually use YouTube shelf spacing and control language rather than portal-style panels.

## Watch (Native-first)

No Bilibili business module is moved.

Normal desktop composition:
- page container uses native Bilibili columns, restyled to a YouTube-like two-column layout;
- left/main column is fluid;
- recommendation column targets about 400px and shrinks responsively;
- 24px inter-column gap;
- player is first and keeps native ownership;
- player shell receives 12px radius in normal mode only;
- native title/info, creator/follow, toolbar, description, comments remain in their original DOM parents and are restyled in place.

Watch title: ~20px, 600 weight, 28px line height.

Channel/action row:
- channel identity stays native;
- subscribe/follow is visually a 36px YouTube-style pill while preserving the native control;
- action controls retain the real Bilibili hit targets and dialogs;
- controls are styled as compact rounded pills without synthetic click bridges.

Description:
- native description remains interactive;
- outer surface gets 12px radius and secondary fill;
- native expand/collapse continues to own behavior.

Comments:
- never moved;
- never cloned;
- no Shadow DOM manipulation;
- only outer width/margin may be styled;
- if a comment selector is uncertain, leave it entirely native.

Recommendations:
- native Bilibili recommendation anchors remain authoritative;
- style the native list in place as YouTube-like compact horizontal cards;
- only use a BiliTube fallback list if no usable native recommendation list exists.

### Player modes

Wide mode: release BiliTube's normal width/grid constraints and let Bilibili size the player. Metadata/comments continue below in document flow.

Web fullscreen: suppress BiliTube fixed chrome and release all normal watch geometry; Bilibili owns the viewport.

Browser fullscreen: BiliTube fixed chrome must not overlay the fullscreen element.

Mini player: do not apply watch-layout constraints to the mini player.

## Search

Header search suggestions stay native-data-backed and keyboard accessible.

All results:
- use Bilibili's official combined search result ordering;
- show at most the highest-relevance channel card from the combined response before videos;
- then show large horizontal video rows;
- no artificial wall of creators.

Video result row:
- 360px-ish 16:9 thumbnail on large desktop;
- title 18px/24px;
- creator row and metadata;
- 2-line description excerpt;
- Hover Preview + Watch Later action remain available.

User tab:
- one channel result per row, circular avatar, name, follower/video metadata, sign, follow control.

Bangumi/media tabs:
- keep route continuity inside BiliTube and use consistent horizontal result geometry.

## Channel / Space

- full-width banner with large rounded corners;
- channel header below with 128-160px circular avatar depending on viewport;
- name, @UID, stats, sign, follow action;
- tab strip: Home / Videos / Dynamic / Collections / Favorites mapping to Bilibili equivalents;
- sticky/scrolling behavior follows YouTube channel tabs where practical;
- upload grid reuses the shared video card component.

## History

- page heading and day groups in the main column;
- horizontal history rows with 246x138-ish thumbnails on large desktop;
- right management column about 320px with local search, clear history, pause/resume history, and native management link;
- management actions use Bilibili APIs only when already implemented and reliable, otherwise open native management.

## Watch Later / Playlist / Favorites

Watch Later and playlist-like pages use YouTube's playlist composition:
- summary panel containing cover/title/count/play-all;
- ordered list of videos beside/below it depending on viewport;
- each row is a native anchor;
- progress remains visible where Bilibili supplies it.

Favorites use a playlist/library structure: selected folder summary plus video list/grid; folder navigation remains explicit and reversible.

## Dynamic / Popular / Live / Bangumi / Message / Account / Creator / Unknown Native Routes

These routes retain native Bilibili content ownership. To keep visual continuity:
- BiliTube header remains consistent;
- the menu always opens the YouTube-like overlay drawer;
- theme tokens and page background are synchronized where safe;
- no full-page invisible overlay is allowed while the drawer is closed;
- no native content is moved into BiliTube roots.

Deep structural rewriting is not performed unless a route has a dedicated BiliTube renderer with tested data support.

## Settings

Settings is grouped like a compact YouTube settings/preferences surface, not a raw checkbox list.

Groups:
- Appearance: theme, default sidebar state.
- Home: following/live/bangumi/popular shelves.
- Playback cards: Hover Preview, preview delay, Watch Later quick action.
- Search: suggestions, result loading mode when supported.
- Content cleanup: promoted/ad hiding.
- Navigation: subscription list visibility.

Every visible option must be wired to runtime behavior.

## Performance and Accessibility

- no route-wide re-render for theme toggles;
- no full-body mutation loop;
- native anchors stay native;
- focus-visible states on buttons/links;
- interactive hit areas at least 36-40px where practical;
- images lazy loaded;
- one active preview video at a time;
- motion reduced under prefers-reduced-motion.

## Forbidden Patterns

- moving/cloning native player, toolbar, comments, follow controls, or native recommendation business modules;
- synthetic pointer/click bridges for native watch actions;
- intercepting ordinary anchors through a navigation bridge;
- custom comment renderer on ordinary video pages;
- broad `pointer-events:none` on native watch ancestors;
- page-sized transparent interaction layers when a drawer/modal is closed.

## Acceptance

Automated tests verify route contracts, DOM non-movement, native-anchor behavior, CSS invariants, settings wiring, player-mode release states, Hover Preview, and Watch Later quick action.

Manual Edge+Bilibili acceptance is mandatory for final production confidence. The checklist covers Home, Search, Channel, Watch, History, Watch Later, Favorites, Dynamic/adapt pages, Sidebar, themes, and player modes.
