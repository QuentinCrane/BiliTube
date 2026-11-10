<p align="center">
  <img src="assets/icon.svg" width="96" height="96" alt="BiliTube 图标">
</p>

<h1 align="center">BiliTube</h1>

<p align="center">把 YouTube 的桌面端浏览体验带到 B 站</p>

<p align="center"><sub>A Chrome / Edge extension that brings a YouTube Desktop-style layout to Bilibili while preserving native playback and interactions.</sub></p>

<p align="center">
  <img alt="Platform" src="https://img.shields.io/badge/platform-Chromium%20%2F%20Edge-4285F4?logo=googlechrome&logoColor=white">
  <img alt="Manifest V3" src="https://img.shields.io/badge/Manifest-V3-34A853">
  <img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?logo=javascript&logoColor=111827">
  <img alt="License" src="https://img.shields.io/github/license/QuentinCrane/BiliTube?color=blue">
</p>

BiliTube 致力于将 YouTube Desktop 的浏览习惯与排版体验带到 B 站网页版。

通过重排网页端外层界面，BiliTube 提供了随窗口宽度自适应的多列推荐网格、左侧常驻侧栏、经典的双栏视频播放页、缩略图无声快显，以及针对非 16:9 比例视频的播放器留白模糊填充。

扩展遵循 **Native-First（原生第一）** 原则：外层排版与快捷操作由 BiliTube 负责；播放器核心控制（画质、倍速、弹幕、分 P、全屏）、点赞投币收藏三连、评论与回复等交互则由 B 站原生组件接管，无缝保留原生播放能力与账号状态。

当前源码版本为 `0.12.6`。纯原生开发，无需编译构建，加载解压目录即可使用。

---

## 页面效果

<p align="center">
  <img src="docs/screenshots/home.png" width="480" alt="BiliTube 首页">
  <img src="docs/screenshots/watch.png" width="480" alt="BiliTube 视频播放页">
</p>

<p align="center"><sub>首页：常驻左侧导航，多列自适应推荐网格　·　播放页：左侧播放器与视频信息，右侧相关推荐</sub></p>

<p align="center">
  <img src="docs/screenshots/dynamic.png" width="480" alt="BiliTube 动态页">
  <img src="docs/screenshots/search.png" width="480" alt="BiliTube 搜索页">
</p>

<p align="center"><sub>动态页：时间线卡片排版　·　搜索页：分类结果与多维筛选</sub></p>

---

## 特性亮点与体验增强

1. **收藏夹内搜索视频**
   - 支持在当前收藏夹内按关键词直接搜索视频标题与 UP 主，包含搜索结果独立分页与一键清空。
2. **首页 4 大内容 Shelf 聚合与独立开关**
   - 首页顶部聚合「关注更新」「正在直播」「番剧更新」「热门内容」横向内容架，每个区域均可单独开关。
3. **缩略图悬停无声预览（Hover Preview）**
   - 鼠标悬停在封面上时静音预览视频内容，并配备进度条；支持自定义起播延迟或关闭预览。
4. **左侧常驻导航与 UP 主直播状态**
   - 提供可折叠的常驻抽屉导航，首页、热门、历史、稍后再看、收藏夹、个人空间及全部分区服务一键直达，并在侧栏展示已关注 UP 主及其开播状态。
5. **播放器留白模糊填充（Ambient Blur Padding）**
   - 播放非 16:9 比例或竖屏视频时，自动提取视频边缘色彩动态填充播放器两侧留白；采用小画布采样跟随视频帧同步刷新，并在播放器离开视口时自动暂停处理。
6. **场景化跳转规则**
   - 首页推荐视频默认在新标签页打开，播放页右侧相关推荐默认在当前页切换（可在设置中分别调整）。
   - 首页搜索在当前页呈现结果，播放页搜索在新标签页打开，不打断正在播放的视频。
7. **快捷稍后再看**
   - 视频卡片封面与播放页均提供“稍后再看”快捷时钟按钮；列表页支持单条快速移除。

---

## 完整功能列表

### 首页与导航
- **多列推荐网格**：布局随窗口宽度自适应调整列数，支持连续无限滚动分页。
- **分区分类入口**：顶部 Chips 标签快速切换推荐分区。
- **4 个独立 Shelf**：关注更新、正在直播、番剧更新、热门内容四个区域可分别开关。
- **左侧导航抽屉**：提供首页、热门、历史、稍后再看、收藏夹、个人空间及分区服务入口；可展示订阅 UP 主及直播状态；支持折叠为 Mini Guide。
- **打开与跳转设置**：首页推荐默认新标签页，播放页右侧推荐默认当前页（可分别设置）；首页搜索当前页，播放页搜索新标签页。

### 搜索
- **全分类覆盖**：支持综合、视频、用户、番剧和影视搜索结果切换。
- **搜索建议与历史**：提供实时搜索建议、B 站官方默认推荐词、热搜榜单以及本地搜索历史（支持键盘上下键选择）。
- **视频排序与时长筛选**：视频搜索支持排序方式（综合/最新/播放多等）与视频时长（10分钟以下、10-30分钟等）直接筛选；直播与专栏等垂直搜索接入原生页面。

### 视频播放页
- **双栏桌面布局**：左侧为播放器、视频标题、UP 主信息、操作栏、简介和评论区；右侧集中摆放相关推荐。
- **保留原生播放器**：画质（4K / 杜比视界 / HDR）、倍速、音轨、弹幕开关、高级弹幕、分 P、宽屏、全屏和画中画等控制 100% 由原生播放器提供。
- **保留原生互动**：点赞、投币、收藏、分享、一键三连、充电，以及完整的评论区、楼中楼与表情包无损使用。
- **播放器留白模糊填充**：以当前画面色彩动态填充非 16:9 留白，跟随视频帧同步刷新，离开可视区域自动暂停。

### 视频卡片与个人内容
- **缩略图悬停无声预览**：带预览进度条，可自定义延迟或关闭。
- **稍后再看快捷操作**：卡片与播放页快捷添加，列表支持单条移除；播放全部和批量管理引导至原生管理页。
- **当前收藏夹内搜索**：支持在当前收藏夹内按关键词搜索视频、结果分页和一键清除；收藏夹创建、编辑、删除和批量管理使用原生管理页。
- **动态页**：按时间线平铺展示视频、文字和图片动态；详情互动与发布接入原生页面。
- **空间与历史记录**：个人空间主页、投稿列表和历史记录页面提供统一外层导航与排版适配，原生历史搜索与管理功能完整保留。

### 外观与个性化设置
- **多主题适配**：浅色、深色、跟随系统。
- **两种风格切换**：默认 YouTube Desktop 基础风格（内置 Roboto 字体），亦可切换为毛玻璃风格。
- **细节显示开关**：侧栏折叠、页面密度、动效强度、卡片作者信息和观看数据显示均可自定义。
- **功能开关**：搜索建议、已识别广告位隐藏、播放器留白模糊填充、悬浮预览和稍后再看快捷按钮均可独立配置。
- **中英双语支持**：跟随浏览器语言自动适配，英文界面全面对齐 YouTube 用词（Trending, Playlists, Subscribe）与紧凑数字缩写（12.3K / 1.2M）。
- **页面辅助**：加载失败可原地重试，久置页面切回可提示更新；替换页面右上方常驻「打开 B 站原页面」入口。

---

## 与 B 站原站的分工

| 模块 | 负责方 | 说明 |
| --- | --- | --- |
| 界面与导航 | **BiliTube** | 页面网格排版、侧栏抽屉、卡片流转、双栏结构、主题风格、快捷操作、收藏夹内搜索与播放器留白填充。 |
| 播放与核心业务 | **Bilibili** | 原生播放器（画质/倍速/弹幕/分 P）、账号鉴权、点赞投币收藏三连、评论系统、动态发布与大会员权益。 |

订阅列表、动态时间线、稍后再看和个人收藏等功能依赖当前的 B 站登录状态。详细的页面能力对应表见 [功能清单](docs/FEATURE_COVERAGE.md)，技术实现与路由策略见 [`docs/TECHNICAL_OVERVIEW.md`](docs/TECHNICAL_OVERVIEW.md)。

---

## 安装与使用

BiliTube 无需构建，直接加载源码即可使用：

1. **获取源码**：
   - 到 [Releases](https://github.com/QuentinCrane/BiliTube/releases) 页面下载发布包并解压；
   - 或使用 Git 克隆仓库：
     ```bash
     git clone https://github.com/QuentinCrane/BiliTube.git
     ```
2. **在浏览器中加载**：
   - 打开 Chrome 或 Edge，在地址栏输入 `chrome://extensions` 或 `edge://extensions`；
   - 开启右上角的「**开发者模式**」；
   - 点击「**加载已解压的扩展程序**」；
   - 选择本仓库的**根目录**（包含 `manifest.json` 的目录）。
3. **日常使用**：
   - 打开或刷新 Bilibili 页面即可生效；
   - 在扩展管理页点击「**扩展选项**」，可配置个性化设置。

---

## 隐私说明

- **无自建服务**：BiliTube 不设中转服务器或远程后端，不收集、不出境任何用户数据。
- **无追踪打点**：扩展内无数据埋点、无第三方统计脚本、不记录用户浏览与观看历史。
- **本地存储配置**：所有界面与偏好设置均保存在浏览器本地的 `chrome.storage.local` 中。
- **权限最小化**：仅在 Manifest 中声明必要的 B 站相关域名权限以拉取列表和封面，不请求无关网站权限。详细说明见 [`docs/PRIVACY.md`](docs/PRIVACY.md)。

---

## English Overview

**BiliTube** brings the **YouTube Desktop browsing experience to Bilibili** on Chrome and Edge, while keeping all native playback and interactive features intact.

- **Key Highlights**:
  - **In-Favorites Video Search**: Search videos directly within the current favorites folder by keywords, complete with pagination and clear action.
  - **4 Top Shelves**: Aggregated shelves for Followed Updates, Live Streaming, Anime Updates, and Trending right on the home page, with individual toggles.
  - **True Hover Video Preview**: Silent video stream preview on card hover with mini seek rail and customizable delay.
  - **Persistent Navigation**: YouTube-style sidebar with live stream indicators for followed creators.
  - **Ambient Blur Padding**: Fills aspect ratio letterboxing with dynamic blurred edge colors; syncs with video frames (`requestVideoFrameCallback`) and pauses when scrolled out of view.
  - **Sensible Navigation Rules**: Home recommendations open in a new tab; watch page recommendations navigate in place (both customizable in settings). Home search opens in place; watch page search opens in a new tab.
- **Native-First Watch Page**: Dual-column layout with the player and video details on the left and related recommendations on the right. Bilibili's native player (4K/HDR/speed/danmaku/parts/fullscreen) and interactions (like, coin, favorite, triple-combo, comments) are completely preserved.
- **Themes & Options**: Dark/light/system themes, frosted glass or YouTube Desktop baseline, customizable density and card information, and bilingual UI following browser locale.

Zero build steps required. Clone the repository and load the folder as an unpacked extension in Developer Mode. For architectural details, refer to [`docs/TECHNICAL_OVERVIEW.md`](docs/TECHNICAL_OVERVIEW.md).

---

## 维护与验证

仓库内置了基于 Node.js 的轻量验证脚本：

```powershell
# 运行全部回归测试
node --test tests/*.test.js

# 检查 Manifest 资源完整性与边界规范
node scripts/verify.mjs

# 检查代码格式与 whitespace
git diff --check
```

- 开发规范见 [`docs/BUILD_GUIDE.md`](docs/BUILD_GUIDE.md)。
- 运行时架构见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。
- 人工验收清单见 [`docs/TESTING.md`](docs/TESTING.md)。

---

## 许可与署名

BiliTube 采用 [MIT License](LICENSE)。版权归属于 `QuentinCrane`。

Bilibili、YouTube 及其相关商标、Logo 和内容版权归其各自所有者所有。BiliTube 为开源社区项目，与哔哩哔哩（Bilibili）官方及 Google / YouTube 无附属关系。

项目引用规范见 [`CITATION.cff`](CITATION.cff)。
