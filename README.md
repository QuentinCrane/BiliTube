# BiliTube

把 Bilibili 的内容，放进更舒服的 YouTube Desktop 信息层级里。

BiliTube 是一个面向 Chromium / Edge 的 Manifest V3 浏览器扩展。它的初衷很简单：YouTube 的桌面页面在导航、卡片密度和观看路径上更耐看，所以希望在不破坏 Bilibili 原生能力的前提下，把 B 站常用页面整理成更清晰的桌面体验。

English summary: BiliTube is a YouTube Desktop-inspired visual layer for Bilibili. It keeps Bilibili's player, comments, complex actions, and native links in charge, while restyling supported desktop surfaces.

当前源码版本：`0.12.4`。本仓库不依赖打包器，安装时直接加载仓库目录；代码修复、测试和文档可以被 GitHub 上的维护者直接审阅。

## Overview

BiliTube 主要负责三件事：

1. 用统一的 56px 顶栏、240px 侧栏、Mini Guide、卡片网格、Shelf、Chips 和深浅色主题，重做 Bilibili 桌面端的外层视觉。
2. 把首页、搜索、动态、频道、历史、稍后再看和收藏夹整理成接近 YouTube Desktop 的浏览路径。
3. 对普通视频页采取 Native-first 策略：播放器、原生 toolbar、简介、评论和相关推荐仍然属于 Bilibili，BiliTube 只负责外层布局和安全的视觉修饰。

项目不试图重新实现 Bilibili 的播放器、评论系统、投币/收藏弹窗或复杂互动。这样做既能保留 Bilibili 的登录态和业务能力，也能减少网站 DOM 或接口变化带来的维护风险。

## Start here

### 安装使用

1. 从 GitHub 下载仓库 ZIP，或使用 `git clone` 拉取仓库。
2. 解压到一个不会频繁移动的目录。
3. 打开 Chrome 或 Edge 的扩展管理页：`chrome://extensions` 或 `edge://extensions`。
4. 开启“开发者模式”。
5. 点击“加载已解压的扩展”，选择包含 `manifest.json` 的 BiliTube 根目录。
6. 重新打开 Bilibili 标签页；如果页面已经打开，建议关闭后再打开，以便 `document_start` 预布局从页面最早阶段执行。
7. 在扩展详情页打开“扩展选项”，调整主题、布局密度、首页 Shelf、Hover Preview、搜索建议等行为。

首次使用不需要创建 BiliTube 账号。公开首页和搜索内容可以直接浏览；历史记录、订阅、动态、稍后再看和收藏夹等能力是否可用，取决于当前 Bilibili 登录状态。

### 最短验证命令

仓库没有 `package.json`，也没有强制的构建步骤。安装前可以直接运行：

```powershell
node --test tests/*.test.js
node scripts/verify.mjs
```

第一条命令运行 Node.js 回归测试；第二条命令检查 Manifest V3 资源、JavaScript 语法、核心模块加载顺序、Native-first 禁止项、主题 token 和路由安全策略。真实 Edge/Chrome + 当前 Bilibili 页面上的点击和视觉验收仍需按照 [`PAGE_AUDIT.md`](PAGE_AUDIT.md) 手动完成。

## What it covers

- 首页推荐网格、Bilibili 关注/直播/番剧/热门 Shelf、首页分类 Chips 和连续分页。
- 搜索建议、综合搜索、视频/用户/番剧/影视 Tab，以及真实 `<a href>` 导航。
- Dynamic / Subscriptions 式内容流。
- Space / Channel 的 Banner、头像、简介、频道 Tab 和投稿网格。
- History 的 Native-first 外层适配；Bilibili 原生历史数据、搜索、清除、分页和管理行为继续保留。
- Watch Later 和 Favorites 的 Library / Playlist 风页面结构、播放进度、收藏夹分页和播放全部入口。
- 普通视频页的 YouTube Desktop 风双栏排版、简单作者镜像、侧栏抽屉和主题切换。
- 卡片 Hover Preview、封面内 seek rail、Hover“稍后再看”按钮和同视频状态同步。
- 设置页中的外观、导航、首页 Shelf、播放与预览、动效、卡片信息、搜索和内容选项。

## Native-first boundary

| 页面或能力 | BiliTube 负责 | Bilibili 负责 |
| --- | --- | --- |
| 首页 / 搜索 / 动态 / Channel / Library | 外层 Shell、导航、卡片布局、分页状态和视觉层 | 内容数据与业务接口 |
| 普通 Watch 页面 | Header、侧栏抽屉、双栏几何、简单作者行和 CSS 装饰 | 播放器、播放控制、标题业务区、原生 toolbar、简介、评论、相关推荐 |
| 点赞 / 投币 / 收藏 / 分享 / 三连 | 不代理、不合成事件 | 原生 toolbar、原生弹窗和原生状态 |
| 评论 | 不重建、不移动、不进入 Shadow DOM 内部 | 评论渲染、输入、回复、楼中楼和权限 |
| 普通链接 | 生成真实 `href`，尊重左键、中键、Ctrl/Command 点击 | 浏览器导航与 Bilibili 路由 |
| 复杂页面 | 外层 Header、Drawer、Theme 和有限样式适配 | 页面主体与业务 DOM |

## Route strategy

路由策略由 [`src/core/policy.js`](src/core/policy.js) 集中决定：

| 策略 | 用途 | 典型页面 |
| --- | --- | --- |
| `replace` | BiliTube 生成完整的桌面内容 Shell | 首页、搜索、动态、稍后再看、收藏夹、Space 首页/投稿 |
| `decorate` | 保留 Bilibili 页面业务 DOM，只添加外层 Watch 装饰 | `/video/BV...` |
| `adapt` | 保留原页面业务结构，添加 Header、Drawer、主题和页面级样式 | History、直播、番剧、课程、账号、创作中心等 |
| `passthrough` | 不接管页面，恢复 Bilibili 原页面 | 显式 `?bilitube_native=1` 或非目标站点 |

在任何页面上追加 `bilitube_native=1`，都可以请求原生 Bilibili 页面。例如：

```text
https://www.bilibili.com/history?bilitube_native=1
```

## Image loading and the infinite-scroll fix

首页、搜索、动态、收藏夹和频道投稿使用无限滚动。旧实现每次追加下一页后会重新生成整个内容出口，已有缩略图的 `<img>` 节点因此会被替换；新节点会先进入 `blur + shimmer` 占位状态，即使浏览器随后命中缓存，也会出现已加载图片再次变模糊的闪烁。

当前实现由两层保护组成：

1. `src/core/ui.js` 为已经触发 `load` 或终态 `error` 的缩略图保存 URL 完成状态。相同图片在后续重绘中会直接以 `is-loaded` 状态创建，不再重新进入模糊过渡。
2. `src/core/app.js` 为异步请求记录 route generation、当前 URL 和请求序号；旧路由或旧分页的响应不会覆盖当前内容。Shell 重绘前也会释放 Hover Preview 的 observer 和事件绑定，避免旧卡片继续持有生命周期。

这不是把所有内容永久缓存到磁盘。图片仍由浏览器按自身缓存策略管理，BiliTube 只在当前页面运行时记住已完成的视觉状态。

## Settings

可在扩展选项中调整：

- 启用/关闭 BiliTube、毛玻璃/YouTube 风视觉、浅色/深色/跟随系统主题。
- 舒适/紧凑页面密度，完整/轻量/关闭外层动效。
- 侧栏默认折叠、订阅列表和首页关注/直播/番剧/热门 Shelf。
- Hover Preview、预览延迟和 Hover“稍后再看”快捷按钮。
- 卡片作者信息、观看数据和 Bilibili 搜索建议。
- 已识别广告位的隐藏。

关闭“启用 BiliTube”后，扩展会移除自己的样式、节点和页面状态，恢复原版 Bilibili 页面。

## Privacy and permissions

BiliTube 没有自建服务器、账号、订阅、广告或云端同步。设置保存在浏览器的 `chrome.storage.local`；运行时缓存主要保留在内存中。

Manifest 中的权限用途如下：

| 权限 | 用途 |
| --- | --- |
| `storage` | 保存设置，并让已打开的 Bilibili 页面同步配置 |
| Bilibili 页面 host permission | 注入样式和内容脚本，处理页面路由与原生 DOM 适配 |
| `api.bilibili.com` | 读取推荐、搜索、历史、动态、订阅、收藏夹和预览等 Bilibili 数据 |
| `hdslb.com` / `bilivideo.com` | 支持 Bilibili 返回的图片、视频和媒体资源 |

扩展不会把用户数据发送到 BiliTube 自己的服务。需要登录态的请求会按照 Bilibili 当前会话和接口规则访问 Bilibili；Bilibili 自身的隐私政策和账号权限仍然适用。详细边界见 [`docs/PRIVACY.md`](docs/PRIVACY.md)。

## Development

### Requirements

- Chrome 或 Edge，支持 Manifest V3。
- Node.js 18 或更高版本，用于运行测试和校验脚本。
- Git（可选，用于拉取源码和提交修改）。

### Project layout

```text
.
├── assets/                 扩展图标
├── docs/                   公共技术、构建、隐私与贡献文档
├── scripts/                静态校验和 smoke 脚本
├── src/
│   ├── background.js       Manifest V3 service worker 与 Bilibili API
│   ├── page/               MAIN-world bridge 与 document_start preflight
│   ├── core/               路由、数据、Shell、UI、Preview、Watch 运行时
│   ├── styles/             preflight 与统一主题/页面样式
│   └── options/            扩展设置页
├── tests/                  Node.js 静态契约、回归和生命周期测试
├── manifest.json           Manifest V3 入口
├── PAGE_AUDIT.md           自动测试与真实页面人工验收矩阵
└── CHANGELOG.md            版本变更记录
```

### Test and verification

在仓库根目录运行：

```powershell
# 全部回归测试
node --test tests/*.test.js

# Manifest、资源、语法与架构边界检查
node scripts/verify.mjs

# 可选：独立运行图片/交互状态回归
node --test tests/interaction-state.test.js
```

测试是 Node.js 原生测试，不需要下载 npm 依赖。测试重点是静态契约、数据归一化、路由策略、Native-first 边界、事件/observer 生命周期和无限分页状态；它们不能代替真实登录态浏览器验收。

### Manual browser check

加载解压扩展后，优先检查以下路径：

1. 首页滚动到下一页，确认已经显示过的封面不会再次模糊。
2. 搜索、动态、收藏夹和频道投稿连续分页，确认旧数据不消失、旧请求不覆盖新路由。
3. 首页卡片左键、中键、Ctrl/Command 点击，确认仍然是浏览器原生导航。
4. Watch 页播放、暂停、音量、弹幕、进度条、点赞、投币、收藏、分享和评论。
5. 宽屏、网页全屏、浏览器真全屏和 mini-player 进出前后布局是否回到 Bilibili 原生控制。

完整清单见 [`PAGE_AUDIT.md`](PAGE_AUDIT.md)。

## Screenshots

为了避免 README 中的图片随着 Bilibili 内容变化而失效，建议发布仓库时由维护者自己截取并放入 `docs/screenshots/`。建议至少包含：

1. `home.png`：首页推荐网格、分类 Chips、侧栏和 Shelf。
2. `watch.png`：普通 Watch 页双栏布局，能看出原生播放器、toolbar、评论和相关推荐仍然存在。
3. `settings.png`：设置页的分组导航和选项。
4. `dark-mode.png`：深色主题或紧凑侧栏。

截图应优先使用无敏感账号信息的页面；真实 Bilibili 封面和头像的再分发也应遵守相应版权与站点规则。项目代码本身不依赖截图文件运行。

## Known limitations

- Bilibili 的页面 DOM、WBI 参数、接口字段和登录策略可能变化；接口不可用时，部分页面会显示兜底信息或退回原生页面。
- 没有登录时，历史、动态、订阅、稍后再看和收藏夹可能为空或返回登录提示。
- 由于播放器和评论由 Bilibili 原生控制，BiliTube 不承诺替换或统一这些区域内部的 UI。
- 自动测试目前以结构和行为契约为主；`PAGE_AUDIT.md` 中标记为“实机”的项目需要在发布前用当前 Chrome/Edge 和 Bilibili 页面复核。
- BiliTube 是个人开源实验性质的视觉层，不代表 Bilibili 官方，也不改变 Bilibili 的内容、权限和服务条款。

## More for builders

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)：运行时、路由策略、Native-first 边界和无限滚动修复。
- [`docs/BUILD_GUIDE.md`](docs/BUILD_GUIDE.md)：安装、测试、发布包和故障排查。
- [`docs/PRIVACY.md`](docs/PRIVACY.md)：权限、数据流和本地存储说明。
- [`CONTRIBUTING.md`](CONTRIBUTING.md)：提交代码、测试和 Pull Request 约定。
- [`SECURITY.md`](SECURITY.md)：安全问题报告与敏感信息处理。
- [`PAGE_AUDIT.md`](PAGE_AUDIT.md)：页面能力矩阵和真实浏览器验收清单。
- [`CHANGELOG.md`](CHANGELOG.md)：变更记录。

文档的组织方式参考了 [Keepix](https://github.com/QuentinCrane/Keepix) README 中“项目动机 → 快速开始 → 隐私 → 构建 → 项目结构 → 贡献”的公开仓库说明节奏，但内容以 BiliTube 的浏览器扩展边界为准。

## License

BiliTube 使用 [MIT License](LICENSE)。Bilibili、YouTube 及相关商标和内容归其各自权利人所有。
