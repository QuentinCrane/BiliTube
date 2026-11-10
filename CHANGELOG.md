# Changelog

## Unreleased

## 0.12.6

- 普通视频页新增播放器留白模糊填充，保持视频原有比例；可在“播放与预览”设置中关闭。
- 收藏夹页面新增当前收藏夹内搜索，支持清除、结果分页和无匹配提示；切换收藏夹、刷新或连续搜索时隔离旧请求，保留正在输入的草稿。
- 修复 Bilibili 重写播放页元素类名后，原生点赞栏和简介被排到评论区下方的问题，继续使用原生互动节点。
- 修复同页切换视频后“稍后再看”可能指向上一条视频的问题；后台读取或写入遇到登录凭据限制时使用同站点回退，读取失败时提示重试。
- 优化 Watch 区域批量观察、长列表重排测量和分页动效，减少重复 DOM 查询；保留卡片、图片和预览的生命周期保护。
- 新增收藏夹搜索、稍后再看和播放页布局浏览器回归，覆盖关键词分页、延迟响应、输入法和原生区域类名更新。
- 英文词表对齐 YouTube 说法：`Popular → Trending`、`Your content → You`、`My channel → Your channel`、`Favorites → Playlists`、`Knowledge → Learning`、`Games → Gaming`、`Follow → Subscribe`、`Log in → Sign in`、`Updates → Posts`、`Most viewed → View count`、`Newest → Upload date` 等 52 条，只改 `_locales/en`。顺带修掉搜索落地页把本地化标签当搜索词的问题——英文界面点「Trending」原本会去 B 站搜 "Trending"。
- 随扩展打包 Roboto（latin 子集变量字体，43 KB，Apache-2.0，`assets/fonts/`）。`--bt-font` 以 Roboto 开头，设置页共用同一份；`web_accessible_resources` 只暴露这一个字体文件，加载失败自动回落系统字体。此前英文界面实际渲染的是 Segoe UI，和 YouTube 的 Roboto 有明显差异。
- 默认外观改为 YouTube 基线：纯白、中性灰、`#065fd4` 蓝，毛玻璃改成在设置里显式开启（此前默认开启）。浅色基线的强调色从 B 站青 `#00aeec` 换成 YouTube 蓝，导航激活态字重 600 → 500，分组标题在基线模式下 500。已保存过设置的环境保留原值，需要手动关一次毛玻璃。
- 英文界面补全：`src/core/ui.js` 里 15 个 `T()` 键此前不在任何语言包中，英文界面会整段回落成中文。现已补齐搜索落地页、搜索结果分组、动态页头与计数、动态图片描述等文案，并新增 `invalid_write_request`，取代写请求失败时直接返回给 toast 的中文提示。
- 英文数字缩写改为按界面语言格式化：此前 `compactNumber` 沿用「万 / 亿」的除数却配 `K` / `B` 后缀，12,345 会显示成 `1.2K`。现在英文走 `Intl.NumberFormat` 紧凑式（`12.3K` / `1.2M` / `1.5B`），中文保持 `1.2万` / `1.2亿`。
- 计数型文案增加 `_one` 单数变体，`i18n.t()` 在计数为 1 时优先取用，避免英文出现 `1 videos`；两个语言包的键集、占位符与单数变体由 `tests/i18n.test.js` 锁定。
- 性能：视频封面与 UP 主头像改为按实际显示尺寸向图床请求 `@Ww_Hh_1c.webp` 变体（失败自动回退原图）。实测封面 42.3 KB → 11.1 KB、头像 83.1 KB → 2.9 KB，一屏 12 张卡片的图片体积约降到原来的 1/9。
- 性能：Hover Preview 取流不再固定先查 `view`。首页/热门/分类的列表项本身带 `cid`，现在直接带到后台，少一次往返；其它列表改用体积约为 `view` 1/3 的 `pagelist`，`view` 仅在最后兜底。
- 性能：无预览流的 BV 结果缓存 30 s，避免反复为同一个视频重试两次请求；预览 URL 缓存对齐到 150 s，不超过后台 `playurl` 的 180 s TTL。
- 新增 `scripts/resource_audit.py`：可复现地测量图片字节、预览查询字节和 500 张卡片的挂载/节点/堆基线；`tests/resource-budget.test.js` 固化上述契约。
- 试验并按实测结果放弃：按列表长度额外启用 `content-visibility` 在无头 Chromium 中没有可复现收益，未纳入仓库。
- 新增 `src/core/motion.js`：同一路由的数据刷新在 `Reconcile.update()` 前后测量可见卡片矩形，用 Web Animations API 做 additive FLIP，卡片、图片和 Hover Preview 节点全程复用，不重建媒体。
- 分页追加只让新卡片淡入，旧卡片不再重复进场；换路由时只为工具条、分类和标题这类轻量 chrome 播放短暂进入动画，避免为整屏列表创建超高的合成层。
- 动效统一由一个决策点控制：`motionMode=none`、系统减少动态效果、正在播放的 Hover Preview、超过 24 张可见卡片或主题 View Transition 进行中，都会跳过动画并直接呈现最终布局。
- 主题 Reveal 仍然独占唯一一次根 View Transition；开始前主动取消局部 FLIP 并清理 transform，局部动画失败时只是失去过渡，内容与交互不受影响。
- 修正路由进入动画的类名不一致（`is-route-entering` 与样式里的 `bt-route-entering`），此前该动画实际从未触发。
- 视觉层回到 YouTube Desktop 基线：撤回上一轮引入的胶囊 chips、渐变品牌标、封面描边与悬停抬升、更小的标题/头像尺寸、13px 侧栏分组标题等改动，恢复 12px 媒体圆角、8px 矩形 chips、36px 头像、16px 侧栏分组标题与原始卡片排版。
- 修复侧边栏展开/收起没有动画：一条用于「视觉风格切换」的 `transition:opacity` 规则覆盖了 `.bt-sidebar` 的宽度过渡与抽屉的位移动画。现在侧栏宽度、`.bt-body` 的 grid 轨道和抽屉 `transform` 一起以 200ms 过渡，内容列跟随侧栏滑动而不是跳变；首屏恢复上次的折叠状态仍为瞬时，不会播放一次折叠动画。
- 保留两处真正的修正：骨架屏头像占位补上 36px 尺寸（此前高度为 0，加载态与真实卡片不对齐），收藏夹选中项的计数文字跟随选中色以提高可读性。
- `regression-0110-youtube-parity` 增加基线锁定断言：`--bt-media-radius` 只允许声明一次且为 12px、卡片头像 36px、chips 8px 且不得出现胶囊圆角，避免后续「美化」再次悄悄改变版式基线。
- 新增 `scripts/motion_smoke.py`（无头 Chromium 数值断言）与 `scripts/ui_preview.py`（离线截图与手动演示），并补充 `tests/motion.test.js`，覆盖策略矩阵、FLIP 数值、取消清理、追加淡入和无 WAAPI 降级。

## 0.12.5

- 修复播放页内推荐视频同页切换时，Watch 装饰器先于原站 Vue 更新被销毁重建、播放器节点重建后脱离布局的问题；保留跨视频导航的布局与观察器，并跟踪 SPA 根节点替换恢复原生播放器标记。
- 主题切换使用约 180ms 的整页快照透明度过渡，移除持续的全屏圆形裁剪；支持快速反向切换，并同时尊重系统减少动态效果和扩展的关闭动效设置。
- 视频页首屏与正式布局共享同一套样式，修复预置排序规则优先级冲突；播放器、标题和工具栏从首次绘制起保持位置，作者信息以等高占位接续，右侧推荐在最终位置显示。
- 原站初始化超过 6 秒时恢复原生作者与推荐内容，并保持该布局，避免迟到的初始化再次挤动内容；新增四种窗口宽度、初始化超时与媒体连续性的浏览器检查。
- 首页、搜索、动态、收藏夹、稍后再看和频道页面增加内容刷新入口；刷新绕过旧响应缓存，保留已有内容，并隔离刷新前的分页请求。返回久置的标签页时提示内容可能更新。
- 分页失败显示重试按钮，保留原分页位置和已加载内容；修复动态初次加载误显为空、首页分类继续请求无关推荐，以及空收藏夹误报失败的问题。
- 调整背景、卡片层级、筛选栏、工具区和内容间距，统一深浅色状态；收敛发光与悬浮阴影，精简重复管理入口，补充稍后再看空列表的发现入口。
- 修复搜索建议在关闭后被迟到响应重新打开、中文输入法确认误选建议、刷新后横向内容栏按钮指向旧节点，以及窄窗口导航抽屉不可用的问题。
- 新增刷新、重试、输入法与缓存回归测试，以及隔离 Edge 浏览器交互和深浅色、390px 窗口截图检查脚本。

- 修复完整视频页启动时作者镜像过早插入原站 SSR 容器，引起 Vue 初始化失败、播放器断开并再次加载的问题；由 MAIN-world 桥接原站初始化状态，之后再插入作者行。
- 主题快照期间只暂停正在运行的装饰动画，结束或取消后恢复。
- 新增真实视频启动事件与主题帧间隔/绘制轨迹探测脚本。

- 修复主题、侧栏设置保存后存储通知重复重绘内容的问题，设置变化按影响范围更新。
- 同页异步更新保留卡片与媒体节点；延迟首页 Shelf、UP 资料和 DOM 兜底返回时不再重新创建已有封面或预览。相同视频的 CDN 缩略图尺寸差异不触发媒体替换。
- 主题快照期间保留悬停预览；过滤重复导航和普通视频页的追踪参数变化，避免重新挂载播放页装饰。
- 首页、搜索和投稿初次加载采用单一数据来源，只有 API 失败时才显示原站卡片兜底；过滤搜索页自动添加的 `vt` 等追踪参数，避免加载途中再次挂载。

- 补齐视频搜索排序、时长筛选、直播/专栏搜索、侧栏分区与创作服务入口、动态详情讨论链接和稍后再看列表移除按钮。
- 动态详情、带播放目标的稍后再看队列、订阅收藏夹与未覆盖的搜索条件保留原生业务页面；替换页面提供当前原页面及管理入口。
- 首页、搜索、收藏夹和投稿页分页追加新卡片，加载提示单独更新；达到至少 300 条后改为手动加载更多。
- 限制响应、缩略图状态和预览缓存容量；清空缓存后拒绝旧请求回填；路由改变和完整重绘时释放分页 observer。
- 新增功能对应表、筛选和缓存回归测试，以及隔离浏览器交互与长列表追加测量脚本。

- **Infinite-scroll thumbnail stability**：修复首页、搜索、动态、收藏夹和频道投稿在追加下一页后整页重绘，导致已经加载完成的缩略图再次进入模糊占位并重新显示加载过程的问题。运行时会记住当前页面已完成的缩略图状态，并在相同 URL 重绘时直接保持清晰。
- 为异步请求增加 route generation、当前 URL 和请求序号校验，避免旧路由或旧分页响应覆盖当前页面。
- Shell 重绘前释放 Hover Preview 的 observer、timer 和卡片绑定；普通搜索输入框在账号/订阅状态更新时保留当前节点和未提交草稿。
- 新增交互状态回归测试，覆盖缩略图重绘、搜索建议竞态、收藏夹路由竞态和 Preview 生命周期。
- 补充 GitHub 开源文档：README、架构说明、构建指南、隐私说明、贡献指南和安全策略。
- 仓库地址统一为 `https://github.com/QuentinCrane/BiliTube`，许可证调整为要求保留版权声明的宽松 `MIT`，并新增 `CITATION.cff` 作为项目引用署名入口。

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
