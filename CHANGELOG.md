## 0.12.4

- **Watch Prepaint Fix**：普通 `/video/` 页面在 `document_start` 立即进入 `bilitube-watch-preflight`，不再等 Watch runtime 完整挂载后才切换布局。
- `src/page/preflight.js` 提前到 isolated-world 内容脚本首位执行，减少前置模块加载造成的首帧时间窗口。
- preflight 直接预留与最终 Watch 一致的双栏、16:9 播放器、外侧 gutter、标题/toolbar/评论顺序和右栏宽度；核心 DOM 就绪后原子切换为 `bt-watch-ready`。
- Watch 标题/信息容器强制 `height:auto / min-height:0 / max-height:none`，清除 Bilibili 固定高度残留，标题到作者行底距由 8px 收紧到 4px。
- preflight 在扩展禁用或 Watch 挂载重试耗尽时主动撤销，避免失败页面长期停留在预布局状态。
- 新增 v0.12.4 回归契约，锁定 Watch document-start prepaint、脚本执行顺序、最终布局切换和信息区高度。

## 0.12.3

- **Watch UI Polish & Stability**：播放器与右侧推荐栏间距由 24px 收紧到 16px，大屏左右安全留白提升到 36px；播放器到标题、标题到作者行的垂直间距同步收紧。
- 右侧推荐改为以整个 `.bt-native-watch-aside` 为作用域恢复卡片信息；标题、UP 名、播放/时间等 metadata 不再依赖首个推荐容器是否被提前标记，懒加载卡片也能继承同一套 YouTube 风布局。
- 收紧 Watch UP 区识别，只匹配真正的作者模块，不再使用过宽的 `.up-info / .upinfo`，避免误伤相关推荐卡片内部信息。
- Watch 改为等待主布局、左右栏、播放器和标题信息同时就绪后一次性启用 `bt-watch-ready`；MutationObserver 从整个 `document.body` 缩到 Watch 主布局与播放器区域，减少首屏异步加载造成的反复重排/抖动。
- 顶栏右侧 `投稿` 改为 `动态`，直接进入 `https://t.bilibili.com/`，继续保持真实链接导航。
- 深色/浅色切换加入约 200ms 的平滑过渡：支持时使用 View Transition，不支持时回退为 CSS 颜色/背景/边框动画；主题按钮同步轻微旋转/缩放，并尊重 `prefers-reduced-motion`。
- 新增 v0.12.3 回归契约，锁定右栏 metadata、原子 Watch 挂载、局部 observer、Dynamic 顶栏、主题动画与间距基线。

## 0.12.2

- **Watch Column Reset**：撤销 v0.12.0 的跨父级 `display: contents` 视觉 flatten；`.left-container / .right-container / .right-container-inner` 恢复为真实布局盒，避免 Bilibili 未标记模块被 Grid 自动排版后产生大面积空白和错位。
- Watch 顶层改为稳定两栏：左侧主栏 `minmax(0,1fr)`，右侧相关推荐栏约 402px；响应式仅缩窄右栏，不再引入第三个虚拟 grid 轨道。
- 左栏内部使用 `display:flex + order`：播放器 → 标题/信息 → BiliTube 简单作者行 → Bilibili 原生 toolbar → 简介 → Bilibili 原生评论；播放器、toolbar、评论本身不换父节点。
- BiliTube 作者行只镜像头像、UP 名、空间链接和关注按钮；点赞、投币、收藏、分享、三连继续完全由 Bilibili 原生 toolbar 处理。
- 右栏保留 Bilibili 原生相关推荐和真实链接；隐藏右栏重复 UP 信息与弹幕列表，避免和 YouTube 风主栏作者信息重复。
- 作者行增加幂等签名，MutationObserver 重扫时不再反复 `replaceChildren()`，避免自触发 DOM mutation 循环。
- 保留 v0.12.1 的 mini 独立状态修复：mini 不切换主页面布局，也不继承普通播放器控制条尺寸。
- 新增 v0.12.2 回归契约，明确禁止 Watch 关键左右栏再次使用 `display: contents`。

## 0.12.1

- Fixed Bilibili `data-screen="mini"` being treated like wide mode on Watch pages.
- Mini player no longer collapses the Watch page into a single full-width layout or hides recommendations.
- YouTube-sized BPX control overrides no longer apply to the native mini player.
- Native mini player geometry is released back to Bilibili while the underlying Watch page keeps its normal grid.

# Changelog

## 0.12.0

- **Watch Native Layout Reset**：不移动 Bilibili 播放器、UP、toolbar、简介、评论与相关推荐节点，通过外层 CSS Grid / `display: contents` 做视觉重排，避免破坏原生事件、React/Lit 生命周期和评论 hydration。
- 普通 Watch 页面按 YouTube Desktop 重新校准：内容最大宽度约 1800px、主播放器优先、右侧相关推荐约 402px、24px 栏间距、播放器 16:9 / 12px 圆角。
- 标题/信息位于播放器下方；UP/关注与原生 toolbar 组成同一信息行；简介和原生评论继续位于主栏；原生相关推荐与播放器顶部对齐。
- 兼容当前 Bilibili `.right-container > .right-container-inner > .up-panel-container / recommend-list` 结构，右栏中间包装层使用视觉 flatten，不移动真实业务节点。
- Bilibili BPX 播放控制条只做视觉尺度校准：正常 Watch 下底栏约 48px、控制 hit-area 约 40px、常用图标约 24px、时间文字约 13px，进度条静止约 3px / hover 约 5px；不替换播放器控件与事件。
- 宽屏 / mini / 网页全屏 / 浏览器全屏继续以 Bilibili 原生状态为准；进入这些模式后释放普通 Watch 的 16:9、三栏和圆角约束。
- **History 改为 native-first Adapt**：`/history` 与 `/account/history` 不再走 BiliTube Replace / 自绘 API 页面；Bilibili 原页面负责登录态、数据、分页、搜索、清除/管理历史等行为，BiliTube 只做 YouTube History 风外层样式。
- Native History 同时覆盖新旧历史页常见结构：`.history-record / .history-wrap / .history-list / .main-breadcrums / .b-head-search / .cover-contain / .r-info / .l-info`。
- 保留 v0.11.0 的真实 `<a href>` 导航、Hover Preview、Hover“稍后再看”、全站 Header / Sidebar、搜索综合结果、Space / Watch Later / Favorites / Dynamic / Settings。
- 新增 v0.12.0 Native Layout Reset 回归契约，覆盖 History 路由策略、Watch 三栏 visual grid、播放器几何、BPX 控制尺度与 History native selectors。

## 0.11.0

- **Watch 架构重置为 Native-first**：删除 0.10.x 的 toolbar/comment slot、占位节点搬运、comment hydration relocation、React Event Bridge、自制 Watch 作者/互动/评论/相关推荐层。
- 普通视频页的播放器、标题/信息、UP/关注、toolbar、简介、评论与相关推荐全部留在 Bilibili 原 DOM 和原父节点中；BiliTube 仅发现区域、添加语义标记 class 并进行 CSS 装饰。
- Watch 不再为原生互动合成 click / pointer 事件；点赞、投币、收藏、分享、三连和相关原生弹窗重新完全归 Bilibili 事件系统所有。
- 评论完全原生：不搬评论根、不重建评论、不请求评论 API、不修改 Shadow DOM 内部结构。
- 原生相关推荐不再复制为 BiliTube sibling 列；保留 Bilibili 推荐节点与真实 href，仅按 YouTube 右栏视觉调整。
- Watch 监听 Bilibili `data-screen`、网页全屏与浏览器 Fullscreen 状态；宽屏/全屏时释放 BiliTube 普通双栏布局。
- 全站统一为 YouTube Desktop 视觉基线：56px Header、240px 展开 Sidebar、72px Mini Guide、12px 媒体圆角、统一 Chips / Pills / 卡片 / Focus / 深浅色 token。
- 顶栏升级为 YouTube 式层级：投稿 Create pill、通知按钮、主题入口、账号头像；搜索框保持居中与建议下拉。
- Sidebar 紧凑模式改为真正的 Mini Guide：核心入口显示图标 + 短标签；组间加入细分割线；滚动时短暂出现 4px thumb。
- Home / Search / Space / History / Watch Later / Favorites / Dynamic 页面统一使用 YouTube Desktop 的页面构图与内容密度。
- 搜索“全部”继续使用 Bilibili 官方 WBI 综合搜索，最多展示 1 个最相关 UP 卡；完整 UP 列表只在“用户”Tab 展示。
- Hover Preview 保留封面内 seek rail，并恢复右上角 YouTube 式“稍后再看”时钟按钮；按钮状态在当前页面同视频卡之间同步。
- 设置页重构为 56px 顶栏 + 240px 左侧分类导航，现有运行时设置按外观 / 导航 / 首页 / 播放与预览 / 搜索 / 内容分组。
- 删除普通 Watch 对重复相关推荐 API 的运行依赖；普通链接继续保持原生 `<a href>`，不经 `preventDefault → bridge → location.assign`。
- 新增 v0.11.0 Native-first Watch 与 YouTube Desktop parity 回归契约。

## 0.10.3

- 对照 BewlyCat / BewlyScript、Bilibili-Evolved、bilibili-cleaner 的当前实现重做 Watch 兼容层，不再假设 B站模块固定同步挂载。
- 评论根节点新增 hydration/可用性判定：等待 `bili-comments` / comment box / renderer 或 Shadow Root 就绪后再移动，避免搬走空壳导致评论、头像、编辑器漏渲染。
- 原生 toolbar 移出原 React 根后标记 `data-bt-react-bridge`；MAIN-world bridge 转发 pointerdown/up/move、mouse、click、focus 等 React props 事件。
- 普通播放页采用 player-first left-column 布局：left-container flex column、playerWrap order 0，隐藏重复 video-info 空白而不移动播放器。
- 宽屏/网页全屏新增 `bt-watch-native-player-mode` 预让位状态，在原生按钮 pointerdown 阶段释放 BiliTube 普通布局。
- 恢复 YouTube 风 Hover“稍后再看”快捷按钮；使用 B站 `/x/v2/history/toview/add` 与 `/del`，并读取当前稍后再看列表维护状态。
- Hover Preview 仍保持视频层点击穿透，仅进度条与“稍后再看”按钮参与命中。
- 新增 0.10.3 开源兼容回归测试。

## 0.10.2

- Watch 播放页改为显式原生模块槽位：BiliTube 只负责位置，`#arc_toolbar_report / .video-toolbar-container` 原节点直接挂入互动槽位，不克隆、不自制投币/收藏弹窗。
- Bilibili 原生评论根节点（`#comment-module / #commentapp / bili-comments` 等）以原节点挂入评论槽位；评论内部 DOM、Shadow DOM、事件与样式仍由 B站负责。
- 所有被移动的原生节点前插入占位 comment；退出 Watch/销毁装饰器时原样放回，避免破坏 SPA 生命周期。
- 原生 toolbar / 评论若晚于播放器异步挂载，由轻量 MutationObserver 自动接入；忽略槽位内部的高频评论更新，避免无意义全页重扫。
- 宽屏/网页全屏改为 capture-phase `pointerdown` 预让位：在 B站原生处理器测量播放器尺寸前先移除 BiliTube 普通双栏约束。
- 宽屏状态下隐藏 BiliTube 重复推荐列，但保留标题、作者、真实 toolbar 与原生评论在播放器下方；网页全屏则隐藏所有 BiliTube 外围 UI，仅保留 B站播放器。
- 播放器状态识别扩展到播放器区域内任意 `[data-screen]` 节点，并继续监听当前宽屏/网页全屏按钮状态。
- 新增原生模块槽位与播放器模式切换回归测试。

## 0.10.1

- 删除 BiliTube 普通链接的 `preventDefault → MAIN-world navigate bridge` 导航链；首页、搜索、历史、收藏、侧栏、头像等恢复标准浏览器 `<a href>` 行为。
- Watch 相关推荐从 Bilibili 原生右栏容器移出，改为 BiliTube 自有 sibling column，避免透明原生层/层叠上下文截获点击。
- Hover Preview 覆盖层默认点击穿透；只有底部 scrubber 接收拖动事件。
- Watch 不再给 Bilibili 原生 toolbar 添加 BiliTube 标记，也不直接修改其 display、position、z-index、pointer-events 或其他几何/外观 CSS。
- 评论区继续完整交还 Bilibili，Watch 运行代码不查询、挂类或重绘评论组件。
- 新增点击命中回归测试，覆盖普通链接、顶部/侧栏、右侧推荐、预览覆盖层、原生 toolbar 零干预等行为。

## 0.10.0

- 重建 Watch 互动架构：BiliTube 保留 YouTube 风作者/标题/简介，Bilibili 真实 toolbar 负责点赞、投币、收藏、分享等复杂动作与原生弹窗。
- 删除 Watch 自制评论 UI 的运行路径；播放页不再查询、标记或重绘 Bilibili 评论组件。
- 相关推荐取消 `preventDefault + location.assign` 导航 shim，缩略图、标题、UP 和分P恢复纯 `<a href>` 浏览器导航。
- Watch 和 Native Adapter 接入 overlay Sidebar drawer；未知 `www.bilibili.com` 页面默认进入低风险 Adapt，因此更多页面可由左上角菜单打开侧栏。
- Sidebar 桌面宽度保持 272px；分组间加入 `1px` 低对比度分割线；隐藏原生滚动轨道，仅滚动时短暂显示细 thumb。
- 搜索“全部”改为 Bilibili 官方 WBI `/x/web-interface/wbi/search/all/v2`，不再并行拼接整页 UP 主搜索；全部页最多展示一个官方综合结果里的 UP 卡片。
- “视频 / 用户 / 番剧 / 影视”仍使用对应分类搜索；用户 Tab 保留完整频道列表和关注能力。
- 设置页增加：订阅列表、首页四类 Shelf、Hover Preview、预览延迟、搜索建议、广告隐藏等选项，并接入运行时设置。
- Hover Preview、首页混合 Shelf、历史/收藏/稍后再看、统一主题和搜索建议继续保留。
