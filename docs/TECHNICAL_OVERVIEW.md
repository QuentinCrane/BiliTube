# BiliTube Technical Overview

本文是 README 的展开版，面向第一次接触 BiliTube 的用户、贡献者和后续维护者。README 负责快速说明“它是什么、怎么安装、有哪些页面”；本文负责说明“每个页面为什么这样做、哪些行为属于 BiliTube、哪些行为必须继续交给 Bilibili”。

## Product position

BiliTube 是 Bilibili 的桌面端视觉与信息架构层，不是新的播放器、评论客户端或 Bilibili API 的替代站点。

```text
Bilibili 内容与原生业务
        +
YouTube Desktop 风的导航、层级和桌面布局
        =
BiliTube
```

项目动机来自一个很具体的使用感受：YouTube 的桌面页面在 Header、Sidebar、卡片网格、搜索结果和观看路径上更容易长时间浏览。因此 BiliTube 选择借鉴这些结构，同时尽可能保留 Bilibili 已经成熟的账号、播放器、评论、互动和内容接口。

## Goals

### Make browsing easier

- 将首页、搜索、动态、频道、稍后再看和收藏夹组织成连续的桌面浏览路径。
- 用一致的卡片尺寸、标题层级、作者信息和元数据减少页面跳跃。
- 保留真实链接，让刷新、打开新标签、中键和 Ctrl/Command 点击继续工作。
- 用侧栏、Shelf、分类 Chips 和设置页减少用户在 Bilibili 页面之间反复寻找入口的成本。

### Improve visual continuity

- 统一 Header、Sidebar、Mini Guide、圆角、卡片间距、主题 token 和动效节奏。
- 通过 `document_start` Watch preflight 减少 Bilibili 原布局先闪现再切换的首屏跳动。
- 用渐进式图片加载、Hover Preview 和统一的错误/空状态处理改善桌面浏览反馈。
- 在深色、浅色、紧凑布局和减少动态效果模式下保持可读性。

### Preserve native behavior

- 播放器、弹幕、播放控制、Bilibili 原生 toolbar、评论和相关推荐不被重建。
- 点赞、投币、收藏、分享、三连、评论输入和回复仍由 Bilibili 原生事件与弹窗处理。
- 复杂页面默认采用 `adapt`，只添加外层视觉和导航，不把 Bilibili 业务节点强行搬进 BiliTube Shell。

## Non-goals

BiliTube 不计划：

- 自己实现一个替代 Bilibili 的播放器。
- 自己实现评论、投币、收藏夹弹窗或复杂互动系统。
- 把 Bilibili 内容镜像到自己的服务器。
- 绕过登录、验证码、权限、付费内容或 CSRF 保护。
- 读取无关网站的页面数据。
- 让视觉层异常导致用户失去原生 Bilibili 页面能力。

## Page capability map

| 页面 | URL 示例 | 策略 | 用户能做什么 | 数据/业务归属 |
| --- | --- | --- | --- | --- |
| 首页 | `https://www.bilibili.com/` | `replace` | 浏览推荐、Shelf、分类、继续分页 | BiliTube Shell + Bilibili API |
| 搜索全部 | `https://search.bilibili.com/all?keyword=...` | `replace` | 看综合结果、切换视频/用户/番剧/影视 | BiliTube Shell + Bilibili 搜索 API |
| 动态 | `https://t.bilibili.com/` | `replace` | 浏览订阅动态、视频和文字动态 | BiliTube Shell + Bilibili 动态 API |
| 普通视频 | `https://www.bilibili.com/video/BV...` | `decorate` | 播放、评论、互动、看相关推荐 | Bilibili 原生 DOM；BiliTube 外层装饰 |
| 历史 | `/history`、`/account/history` | `adapt` | 使用 Bilibili 原生历史搜索、分页、清除和管理 | Bilibili 原生页面 |
| 稍后再看 | `/list/watchlater` | `replace` | 查看进度、打开视频、播放全部、移除 | BiliTube Library + Bilibili API |
| 收藏夹 | `/space/{mid}/favlist` | `replace` | 切换收藏夹、分页、播放全部 | BiliTube Library + Bilibili API |
| 频道 | `/space/{mid}`、`/space/{mid}/upload` | `replace` | 查看频道、投稿、关注、频道 Tab | BiliTube Shell + Bilibili API |
| 直播/番剧/课程/账号 | 对应 Bilibili 子站或原生页面 | `adapt` | 保留原页面业务，使用统一外层导航 | Bilibili 原生页面 |

在任意支持页面上增加 `bilitube_native=1`，可以显式请求原生 Bilibili 页面。例如：

```text
https://www.bilibili.com/history?bilitube_native=1
```

## User journeys

### First install

1. 用户在 Chrome/Edge 的扩展管理页加载包含 `manifest.json` 的仓库目录。
2. BiliTube 在 Bilibili 页面最早阶段加载样式和路由判断。
3. 用户打开首页，看到 Header、Sidebar、分类 Chips 和推荐卡片。
4. 用户可以从扩展选项调整主题、密度、Shelf、预览和搜索建议。
5. 设置写入 `chrome.storage.local`，已打开的 Bilibili 页面会同步更新。

### Home browsing

首页包含：

- 顶部搜索框和动态/消息/主题/视觉样式入口；
- 240px 展开侧栏或 72px Mini Guide；
- “全部、直播、番剧、知识、科技、游戏、音乐、影视”分类 Chips；
- “为你推荐”视频网格；
- 关注、直播、番剧和热门 Shelf；
- 无限滚动哨兵和加载/空状态。

当用户向下滚动时，BiliTube 请求下一页并合并去重。已经完成加载的缩略图不会因为下一页触发重绘而再次进入模糊状态；这部分修复见 [图片加载回归说明](TESTING.md#infinite-scroll-thumbnail-regression)。

### Search

搜索框支持 Bilibili 官方联想词和键盘导航：

- 输入后约 180ms 请求搜索建议；
- `ArrowUp` / `ArrowDown` 选择建议；
- `Enter` 提交选中建议；
- `Escape` 关闭建议；
- 路由变化后旧建议响应不能覆盖新关键词。

综合搜索最多展示一个官方 UP 卡片并保留大量视频结果；完整频道列表在“用户”Tab 展示。搜索结果卡片使用真实视频、作者和频道链接。

### Watch

普通视频页是 BiliTube 最重要的兼容边界：

```text
Header / Drawer
        │
┌───────┴──────────────────────────────┐
│ Bilibili 原生左栏                    │  Bilibili 原生相关推荐
│ 播放器                               │  原生卡片与链接
│ 标题 / 信息                          │
│ BiliTube 简单作者镜像                │
│ Bilibili 原生 toolbar                │
│ 简介                                 │
│ Bilibili 原生评论                    │
└─────────────────────────────────────┘
```

BiliTube 可以调整外层列宽、间距、圆角、主题和作者镜像，但不把这些原生节点移动到自定义 slot，也不复制一套替代互动控件。

### Native pages

对于 History、直播、番剧、账号、创作中心等复杂页面，BiliTube 使用 `adapt`：

- 隐藏或让位给原生 Header 的外层空间；
- 提供一致的 BiliTube Header、Sidebar Drawer、主题和菜单入口；
- 对可安全识别的外层容器做页面级视觉适配；
- 不替换页面内部业务组件；
- 出错时恢复原生页面。

## Feature behavior

### Cards and links

视频卡包含缩略图、标题、作者、观看数据、发布时间和可选时长。普通卡片使用真实 `<a href>`，Hover Preview 覆盖层默认穿透点击，只有预览 seek rail 和“稍后再看”按钮处理自身事件。

### Infinite loading

首页、搜索、动态、收藏夹和频道投稿支持连续分页。分页请求有三层保护：

1. 根据视频 ID 或业务键合并去重；
2. 根据当前 route generation 和 URL 丢弃旧页面响应；
3. 根据 API key 的请求序号丢弃同一 feed 的旧响应。

### Thumbnail loading

缩略图先显示占位和轻微模糊，再在 `load` 或终态 `error` 后转为完成状态。当前页面中相同 URL 的后续重绘直接使用完成状态，避免用户向下滚动时看到已有图片再次模糊。

### Hover Preview

预览只允许一个活动卡片：

- 鼠标进入后等待设置的延迟；
- 通过 service worker 请求 Bilibili 预览媒体；
- 卡片离开、滚出视口或路由重绘时暂停并清理 video；
- seek rail 使用 pointer 事件，但普通封面链接保持浏览器默认行为；
- 路由切换前断开 observer 和卡片绑定。

### Watch Later

“稍后再看”有两种入口：

- 视频卡右上角 Hover 时钟按钮；
- Watch Later Library 页面内的列表、进度和播放全部。

状态来自 Bilibili API，当前页面中同一个视频的按钮会同步更新。Native Watch 的复杂播放行为不被 BiliTube 改写。

## Settings surface

设置页按用户任务分组：

| 分组 | 选项 |
| --- | --- |
| 外观 | 启用 BiliTube、毛玻璃/YouTube 风格、主题 |
| 导航 | 默认折叠侧栏、显示订阅列表 |
| 首页 | 关注、直播、番剧、热门 Shelf |
| 播放与预览 | Hover Preview、预览延迟、稍后再看按钮 |
| 交互与动效 | 舒适/紧凑密度、完整/轻量/关闭动效 |
| 卡片信息 | 作者信息、观看数据 |
| 搜索 | 实时搜索建议 |
| 内容 | 已识别广告位隐藏 |

设置变更必须同时经过：默认值、设置页控件、`chrome.storage.local`、运行时应用和文档五个层次。不要添加只改变 toast 而不改变真实行为的假设置。

## Data and permission boundaries

扩展通过 service worker 请求 Bilibili 数据，主要包含：

- 推荐、分类和 Shelf；
- 搜索和搜索建议；
- 用户信息、订阅和动态；
- 历史、稍后再看和收藏夹；
- Space 资料和投稿；
- Hover Preview 播放地址。

Manifest 权限仅包含 `storage` 和 Bilibili 相关 host permissions。BiliTube 没有自己的云端数据服务，不上传用户媒体，不收集浏览遥测。登录态、Bilibili Cookie、CSRF 和接口权限由 Bilibili 和浏览器管理，详见 [`PRIVACY.md`](PRIVACY.md)。

## Visual language

- Header 高度约 56px。
- 展开 Sidebar 约 240px，Mini Guide 约 72px。
- 视频媒体默认 16:9，常规圆角约 12px。
- 卡片标题最多两行，作者和观看数据使用较弱对比度。
- 浅色模式以白/浅灰为底，Bilibili 蓝作为强调色。
- 深色模式降低纯白面积，保持文字、焦点和按钮的对比度。
- `prefers-reduced-motion: reduce` 时关闭外层过渡和预览动效。

这些数值是当前视觉基线，不是 Bilibili 官方设计规范。调整时应同步检查普通页面、Watch、Adapt 页面和设置页。

## Current limitations

- Bilibili DOM、WBI 参数和接口字段可能变化，自动测试不能证明生产页面永远兼容。
- 登录态内容的可用性取决于账号、区域和 Bilibili 当前接口权限。
- 推荐封面、头像和标题属于动态内容，截图只能作为视觉证据，不能作为接口字段样本。
- 当前公开截图固定覆盖首页、动态、Watch 和搜索；设置、深色模式、Library 和 Hover Preview 的行为以源码、自动测试和真实浏览器验收为准。

## Source of truth

当不同文档描述不一致时，以以下顺序核对：

1. 当前源码与 `manifest.json`；
2. `tests/` 和 `scripts/verify.mjs` 的可执行契约；
3. [`PAGE_AUDIT.md`](../PAGE_AUDIT.md) 的人工验收边界；
4. README、发布说明和截图。

截图和文案不能反向证明一个尚未在当前代码中实现的功能。
