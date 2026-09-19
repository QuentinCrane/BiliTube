# BiliTube 0.12.4

BiliTube 是一个面向 Chromium / Edge 的 Bilibili 桌面端重构扩展。0.12.4 继续以 **YouTube Desktop** 为视觉基线，同时优先保护 Bilibili 原生播放器、toolbar、评论和链接行为。本版继续收口 Watch 首屏稳定性：在 document_start 阶段就预留最终播放页几何，避免 Bilibili 原布局先绘制一帧后再切换；同时清除标题信息区残留固定高度，让作者行更贴近标题。

## 0.12.4：Watch Prepaint & Spacing Fix

### Watch

普通视频页继续不移动、克隆或替换 Bilibili 的播放器、toolbar、简介、评论和相关推荐。v0.12.4 在 v0.12.3 的稳定双栏基础上，把“首屏布局何时生效”提前到 document_start：


- `/video/` 页面在 Bilibili 主体 DOM 出现前就进入 `bilitube-watch-preflight`；预布局已经包含最终双栏宽度、16px 栏间距、16:9 播放器、响应式 gutter 与左栏顺序。
- `preflight.js` 在 isolated-world 内容脚本中最先执行；Watch runtime 完成区域发现后只做 `preflight → bt-watch-ready` 原子切换，不再经历可见的第二套页面几何。
- `.video-info-container / #viewbox_report` 强制回归内容高度，避免 Bilibili 固定 `height/min-height` 把作者头像推远；标题信息到作者行间距收紧到 4px。
- `.left-container` 与 `.right-container` 保持 Bilibili 原生左右栏盒模型，顶层只做稳定两栏布局；内容最大宽度约 1800px，右侧相关推荐约 402px；栏间距收紧到 16px，大屏左右安全留白约 36px。
- 左栏内部使用 Flex/Order 排成：播放器 → 标题/信息 → 简单作者行 → 原生 toolbar → 简介 → 原生评论。
- 作者行由 BiliTube 镜像头像、UP 名、空间链接和关注；复杂互动不复制，点赞 / 投币 / 收藏 / 分享 / 三连仍由 Bilibili 原生 toolbar 处理。
- 播放器正常模式按 16:9 呈现并使用 12px 圆角。
- Bilibili 原生相关推荐保持真实 DOM 和真实链接；右栏所有推荐卡统一恢复两行标题、UP 名与播放/时间 metadata，懒加载卡片也不依赖单个容器预先打标。
- Watch 会等待左右栏、播放器与标题等核心 DOM 就绪后一次性进入 `bt-watch-ready`；后续 observer 只观察 Watch 主布局和播放器区域，不再扫描整个 `document.body`，减少首屏反复重排。
- BPX 播放控制条仅做视觉尺度校准：底栏约 48px、控制 hit-area 约 40px、图标约 24px、时间约 13px、进度条静止约 3px / hover 约 5px。功能、事件和弹窗仍全部由 Bilibili 原播放器处理。
- 宽屏、mini、网页全屏和浏览器真全屏时释放普通 Watch 的两栏、16:9 与圆角约束。

### History

History 不再由 BiliTube 自己请求历史 API 后 Replace 整页。`/history` 与 `/account/history` 改为 **native-first Adapt**：Bilibili 原页面负责历史数据、登录状态、分页、搜索、清除与管理记录，BiliTube 只把外层视觉适配成接近 YouTube History 的横向条目和管理界面。这样 Bilibili 历史接口或内部 cursor 改动时，不会直接导致整个 BiliTube History 页面失效。

## 全站 YouTube Desktop 基线

- **Header**：56px；左侧菜单 + BiliTube，中间搜索，右侧动态、通知、主题与头像。
- **Sidebar**：展开 240px，折叠 72px Mini Guide；分组使用低对比度细分割线；滚动时短暂显示细 thumb。
- **Home**：YouTube 推荐 Grid 为主，穿插关注 / 直播 / 番剧 / 热门 Shelf。
- **Search**：实时 Bilibili suggest；“全部”使用官方综合搜索并最多展示 1 个最相关 UP 卡 + 大量视频；用户 Tab 才展示完整频道列表。
- **Space / Channel**：Banner、头像、名称/简介、频道 Tab 与投稿 Grid 采用 YouTube Channel 信息层级。
- **Watch Later / Favorites**：采用 Playlist / Library 风信息架构，数据仍来自 Bilibili。
- **Dynamic / Subscriptions**：统一成订阅式内容流。
- **Settings**：56px 顶栏 + 240px 左分类导航，配置连接真实运行时行为。
- **Theme**：深浅色切换优先使用 View Transition，回退为约 200ms CSS 过渡；尊重系统“减少动态效果”设置。

## 视频卡交互

BiliTube 自己创建的视频卡继续提供 Hover Preview。预览覆盖层默认点击穿透，只有底部拖动进度条和右上角 **“稍后再看”** 时钟按钮接收点击；普通卡片始终保留真实 `<a href>`，因此左键、中键和 Ctrl / Command + 点击遵循浏览器默认导航。

## 安装

1. 解压发行 ZIP。
2. Edge 打开“扩展” → “管理扩展”。
3. 开启“开发人员模式”。
4. 选择“加载解压缩的扩展”，指向 `BiliTube-Edge-v0.12.4` 目录。
5. 禁用或删除旧版 BiliTube，并关闭所有已打开的 Bilibili 标签页后重新打开。

详细页面边界与人工验收清单见 `PAGE_AUDIT.md`。自动测试不能替代登录态 Edge + 当前 Bilibili 生产页面的真实点击与视觉验收。


### v0.12.4 Watch 首屏稳定性

Bilibili `data-screen="mini"` is treated as a floating player state, not as wide mode. The normal Watch grid and recommendations remain intact while Bilibili owns the mini-player geometry.
