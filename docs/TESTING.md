# Testing and Validation

这份文档分别记录自动测试、真实浏览器和截图证据：自动测试覆盖源码行为，真实浏览器记录当前 Chrome/Edge 与 Bilibili 页面中的交互结果，截图记录页面状态和视觉层级。

## Evidence levels

| 级别 | 说明 | 能证明什么 |
| --- | --- | --- |
| 静态校验 | `node scripts/verify.mjs` | Manifest 资源、JS 语法、路由策略、主题 token 和 Native-first 禁止项 |
| Node 回归 | `node --test tests/*.test.js` | 数据归一化、UI 契约、异步竞态、observer 生命周期和页面边界 |
| 扩展加载 | Chrome/Edge“加载已解压的扩展” | 当前目录可以作为 Manifest V3 扩展启动 |
| 真实页面 | 登录态或未登录态的当前 Bilibili 页面 | 真实点击、导航、播放、评论、分页和视觉状态 |
| 截图 | `docs/screenshots/` | 记录截图时的页面构图和内容状态 |

每条结论都应对应相应的证据级别。Node 测试记录源码合同和状态行为；生产页面的交互结论附浏览器版本、登录状态、页面和操作记录。

## Automated commands

在仓库根目录运行：

```powershell
# 全部 Node.js 回归
node --test tests/*.test.js

# 独立运行交互/生命周期回归
node --test tests/interaction-state.test.js

# Manifest、资源、语法和架构边界
node scripts/verify.mjs

# 提交前检查空白错误
git diff --check
```

动效与界面需要真实 Chromium 渲染，用两个独立的脚本，不新增 npm 依赖（脚本以 Chrome/Edge 无头模式运行，可用 `BROWSER_EXECUTABLE` 覆盖路径）：

```powershell
# 同路由 FLIP、分页追加、动效开关和主题互斥的数值断言
python scripts/motion_smoke.py

# 图片字节、预览查询字节和 500 张卡片的挂载基线
python scripts/resource_audit.py --runs 3

# 生成首页、搜索、收藏、动态、稍后再看、频道、骨架屏的深浅色截图
python scripts/ui_preview.py --tag after
python scripts/ui_preview.py --tag after-dark --theme dark
```

`ui_preview.py` 会把确定性的 SVG 封面、固定数据和一个离线夹具页写入 `output/ui-preview/<tag>/`，用于同一版本前后对比；`--demo` 参数可以生成带“打乱顺序 / 追加 / 切换主题 / 动效强度”按钮的手动演示页。两者都不访问 Bilibili，也不代表登录态下的接口兼容性。

当前仓库不需要 `npm install`，也没有 `package.json`。测试使用 Node.js 内置 test runner，扩展运行时使用浏览器提供的 Chrome API。

## Test areas

### Data and API contracts

覆盖推荐、搜索、动态、历史、稍后再看、收藏夹、Space、订阅、WBI 参数和账号数据归一化。重点是：

- API 缺少可选字段时不崩溃；
- 视频、作者和频道链接仍然可导航；
- 分页参数和游标不被错误重置；
- 登录失败或数据为空时保留可理解的空状态。

### Native-first Watch

回归测试约束：

- 播放器、原生 toolbar、评论和相关推荐不被 BiliTube 移动或克隆；
- 原生评论 Shadow DOM 不被访问或重建；
- Watch 的宽屏、网页全屏、浏览器全屏和 mini-player 由 Bilibili 状态控制；
- BiliTube 不合成原生点赞、投币、收藏、分享和评论事件；
- 推荐视频使用原生 anchor 导航；开启新标签页选项时阻止原站额外的同页跳转。

### Route and response races

验证用户快速切换搜索关键词、收藏夹、频道或页面时：

- 旧响应不会替换新页面；
- 旧 loading 状态不会清空新页面；
- 同一个 feed 的旧请求不会覆盖后发请求；
- 已销毁的页面不会继续收到 observer、timer 或 Preview 回调。

## Infinite-scroll thumbnail regression

### Original symptom

首页、搜索、动态、收藏夹或频道投稿向下滚动后，下一页数据到达并触发重绘。之前的 renderer 会重新创建已有卡片的 `<img>` 节点，新节点先进入模糊和 shimmer 状态，因此已看清的封面会短暂再次变模糊并重新显示加载过程。

### Expected behavior

1. 用户向下滚动触发下一页。
2. 新卡片可以显示加载状态。
3. 已经完成的旧卡片保持清晰，不重新播放模糊过渡。
4. 旧图片的 Preview observer 和事件不会被重复绑定。
5. 旧分页响应不会覆盖当前路由。

### Source fix

- `src/core/ui.js` 通过 URL 记录当前页面中已经完成的缩略图状态。
- 同一 URL 后续被重绘时直接创建为 `is-loaded`。
- `src/core/app.js` 使用 route generation、当前 URL 和请求序号丢弃过期响应。
- Shell 重绘前调用 Preview cleanup，避免 detached card 继续被 observer 持有。
- `tests/interaction-state.test.js` 模拟一张已经完成的缩略图，再创建同 URL 卡片并断言不会回到 `is-preview`。

## Manual acceptance matrix

### Native History layout

```powershell
python scripts/history_native_smoke.py
```

该脚本在临时、未登录的 Edge 配置中加载当前 Bilibili 历史页面和本地扩展，将历史读取、搜索和写入接口全部拦截为合成数据。它检查日期分组、单列卡片、滚动加载、搜索与筛选、原生视图切换、单条删除、批量选择、清空和暂停记录确认，以及深色和窄屏布局。此测试不访问或更改真实账号的历史记录，也不等同于登录态验收。

### Theme transition and Watch startup

```powershell
python scripts/watch_layout_smoke.py
python scripts/media_continuity_smoke.py
python scripts/theme_performance_probe.py --runs 3 --scale 2
python scripts/watch_startup_probe.py --decorated-only --seconds 8
```

前两项使用隔离页面：检查四种宽度下预绘、挂载与作者信息到达的几何一致性、超时回退、媒体节点与播放连续性、快速主题反转及关闭动效设置。后两项在临时 Edge 配置中加载实际扩展，访问未登录的公开搜索与播放页；分别记录 RAF/绘制轨迹及媒体事件/区域坐标/布局偏移来源。真实帧率仍取决于浏览器、硬件和显示器，生产播放器内部的布局变化需要与 BiliTube 外层几何分别判断。

### Related-video navigation

```powershell
python scripts/watch_navigation_probe.py --clicks 5
```

在临时、未登录 Edge 配置中加载实际扩展，使用播放页推荐的默认当前页设置，点击原生右侧推荐链接，记录每次切换的截图、播放器位置、媒体状态与 document timeOrigin，输出在 `output/watch-navigation/`。相同 timeOrigin 表示同页导航；检查要求完成指定次数且播放器保持在标题上方。实际媒体状态单独记录，网络失败或视频权限可能影响播放。

`watch_layout_smoke.py` 同时模拟原站清除播放器、工具栏、简介和推荐区的 class，将原生高度设为 0、替换外层容器和延迟插入评论；检查原生区域顺序与点击、推荐导航、媒体节点身份、mini / wide / web 模式退出后的恢复以及销毁后监听释放。

`python scripts/watch_later_smoke.py` 使用模拟账号和接口数据，检查稍后再看的同站点读取与写入回退、加入和移除、视频切换及读取失败处理；不会访问或修改真实账号的数据。

`python scripts/watch_controls_smoke.py` 使用离线播放器控件夹具检查桌面悬浮样式、动态出现的字幕和可选控件的垂直对齐、原生控件的显示状态与菜单交互。加上 `--live` 会在临时未登录的 Edge 配置中加载公开 Bilibili 视频和本地扩展，验证字幕菜单、播放、音量、时间输入、清晰度菜单及播放器模式切换；结果不代表登录态字幕切换验收。

`python scripts/recommendation_navigation_smoke.py` 使用临时未登录配置检查实际扩展中首页与播放页推荐和搜索的打开方式，以及推荐设置分别保存和同步、修饰键与键盘导航。

`python scripts/favorites_search_smoke.py` 使用隔离接口数据验证当前收藏夹搜索、分页、清除、无匹配结果、输入法、刷新与切换收藏夹；同时检查迟到响应隔离和搜索草稿保留。

### Refresh, failure recovery and responsive layout

`python scripts/refresh_experience_smoke.py` 在独立 Edge 中注入仓库运行代码和确定性的接口数据，验证以下行为，并将报告和截图写入 `output/playwright/refresh-experience/`：

- 主动刷新保留旧卡片、缩略图和搜索草稿；迟到的分页响应不能覆盖新结果。
- 分页失败停止自动重试，用户点击重试后继续原页；刷新成功后从新的第一页继续分页。
- 稍后再看刷新失败保留已有列表，成功的空响应清空列表并提供首页入口。
- 搜索建议关闭后不再被迟到响应打开，方向键提供可访问的选中状态，中文输入确认保持原生行为。
- 刷新后的横向内容栏可继续滚动；久置标签页返回时显示更新提示。
- 首页、搜索、收藏夹、动态、稍后再看、深浅色和 390px 布局；窄窗口导航文字可见，Escape 关闭并恢复焦点。

该脚本以虚构内容和本地 SVG 封面验证仓库运行代码的 UI 与交互契约；扩展包加载和当前登录态接口兼容性记录在下方生产页面验收矩阵。

### Home and library

- [ ] 首页卡片左键打开视频。
- [ ] 中键、Ctrl/Command 点击打开新标签或保持浏览器默认行为。
- [ ] 向下滚动后旧封面不重新模糊。
- [ ] 搜索、动态、收藏夹、频道投稿可以连续分页。
- [ ] 空数据和 API 失败有明确提示，不出现空白白屏。

### Search and navigation

- [ ] 搜索建议出现、可用键盘选择、Escape 可关闭。
- [ ] 全部/视频/用户/番剧/影视 Tab URL 正确。
- [ ] 搜索结果中的视频、UP、头像和频道链接分别指向真实页面。
- [ ] Header、Sidebar、订阅和设置入口不会因为账号请求延迟而消失。

### Watch

- [ ] 播放器播放、暂停、音量、进度条和弹幕保持 Bilibili 原生行为。
- [ ] 点赞、投币、收藏、分享和三连仍使用 Bilibili 原生 toolbar。
- [ ] 评论列表、评论输入、回复和楼中楼仍可用。
- [ ] 相关推荐封面、标题和 UP 链接可点击。
- [ ] 连续从右侧推荐进入其他视频，无需刷新，播放器始终位于标题上方且可以播放。
- [ ] 宽屏、网页全屏、浏览器真全屏和 mini-player 进出正常。
- [ ] Watch 的菜单可以打开 Sidebar Drawer，遮罩可以关闭。

### Settings and restoration

- [ ] 主题、动效、密度、Shelf 和 Preview 设置能保存。
- [ ] 设置变更会同步到已打开页面。
- [ ] 关闭“启用 BiliTube”后，BiliTube 自己的 Shell、样式、observer 和状态被清理。
- [ ] URL 增加 `bilitube_native=1` 后可以恢复原生 Bilibili 页面。

## Browser evidence template

性能修改的测量方法、对比结果和验收边界见 [PERFORMANCE.md](PERFORMANCE.md)。确定性的浏览器性能回归可运行 `python scripts/performance_audit.py`；时间对比应独立、顺序运行。

真实页面验收可以按下面格式记录在 Issue、PR 或 release notes 中：

```text
Browser: Edge 版本 / Chrome 版本
OS: Windows 版本
Extension commit: <commit>
Login state: logged-in / logged-out
Page: https://www.bilibili.com/...
Actions: 具体滚动、点击、切换和等待动作
Expected: 期望结果
Observed: 实际结果
Evidence: screenshot path or short recording path
Limitations: 未验证项目
```

不要上传 Cookie、完整请求头、私信、历史记录或未脱敏账号截图。

## Screenshot evidence

当前公开素材在 [`docs/screenshots/`](screenshots/README.md)：

- `home.png`：首页；
- `dynamic.png`：动态；
- `watch.png`：普通视频播放；
- `search.png`：搜索结果。

这些图片记录页面构图。交互、性能和复现步骤分别记录在对应的自动测试与浏览器验收证据中。

普通视频页的播放器留白填充可运行 `python scripts/player_ambient_smoke.py`：隔离 Edge 夹具覆盖竖屏和超宽画面、视频帧与背景颜色跟随、原生控件命中、暂停与恢复、滚出视野、设置同步、帧不可绘制时的回退、无视频帧回调的兼容路径、视频替换和网页全屏。脚本需要 Python 的 Playwright 与 Pillow，截图写入 `output/player-ambient/`；真实页面的播放器兼容性仍需单独检查。

`python scripts/player_ambient_benchmark.py --baseline-dir <旧版源码目录> --fps 30` 用 FFmpeg 生成本地视频，在相同 1920 × 1080 夹具中交替运行旧版和当前实现；`--fps 60` 测试 60 帧素材。结果包含更新频率、画布尺寸、回调时的采样间隔、丢帧与渲染线程耗时；若安装 `psutil` 还记录浏览器进程 CPU 时间。结果不等同于用户显卡的 GPU 占用或屏幕显示延迟。
