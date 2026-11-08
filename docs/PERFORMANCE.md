# 性能优化与验证记录

验证日期：2026-10-26。基线为提交 `1e6f636`，优化结果为本次工作区代码。

## 修改范围

- 首页、搜索、收藏、频道、动态、历史记录和稍后再看：暂存渲染阶段为未变化的卡片生成占位节点，再复用已连接的原节点，避免先构建完整卡片再丢弃。重复视频按展示类型和内容签名分配实例，防止抢占另一个仍在播放的卡片。非键控兄弟节点使用索引匹配。
- Watch：按 MutationObserver 批次过滤播放器内部、扩展自身和已断开的节点，合并重复子树扫描；类名观察器只修复缺失的布局标记。原生播放器、工具栏、评论和推荐节点保留原位。
- 原生适配页：合并 Header 选择器，过滤扩展自身变更；Watch 和原生适配共用已有的 Chrome 更新逻辑，避免相同账号或订阅状态反复创建抽屉。
- 主题和图片：移除主题切换前的全页动画枚举，把子树样式变更推迟到截图更新阶段；通过 CSS 暂停扩展装饰动画，保留 180 ms 透明度切换及减少动态效果设置。缩略图加载完成后停止加载光带动画。
- 预览和请求：隐藏标签页时释放预览视频及其媒体源；离开路由时清理读取等待、计时器和原生请求回退。已发送的扩展消息不能中止底层网络请求，其迟到结果会被忽略。写操作不受读取取消影响。
- 数据请求：账号信息和 WBI 签名共享 `/nav` 缓存及并发请求；隐藏订阅栏时跳过订阅读取，重新启用时补取。
- 跨页验证同时修复了历史记录非空时调用缺失 `dayLabel` 函数的异常，并添加日期缺失回退文案。

## 可重复对比

使用 `scripts/performance_audit.py`，在独立无头 Edge 156.0.4314.42 中依次运行基线和优化代码，视口为 1920 × 1080，设备缩放为 2，完整动效开启。两次运行使用相同的本地图片与数据，每个计时场景重复 5 次，表中时间为中位数。计时不包含其他并发浏览器测试。

| 场景 | 基线 | 优化后 |
| --- | ---: | ---: |
| 500 张卡片，同内容刷新 | 7.6 ms | 2.8 ms |
| 同内容刷新新建 HTML 节点 | 7016 | 516 |
| 500 张卡片，单张元数据变化 | 7.6 ms | 2.5 ms |
| Shelf 插入或移除 | 9.6 ms | 4.3 ms |
| 主题切换的样式计算总耗时 | 22.84 ms | 12.00 ms |
| 主题切换请求至结束 | 234.6 ms | 215.1 ms |
| 最终 5 次主题测量的最大帧间隔 | 49.9 ms | 33.4 ms |
| 已加载缩略图仍运行的光带动画 | 41 | 0 |
| 一批 200 个播放器内部节点插入引发的区域查询 | 400 | 0 |
| 原生页面 10 次相同 Chrome 更新新建 HTML 节点 | 870 | 0 |
| 原生适配层内部一次插入引发的 Header 查询 | 5 | 0 |

卡片刷新时间只统计同步渲染和 DOM 更新，不代表首屏加载时间。新建节点数统计 `document.createElement` 调用，不包含 SVG 内部节点。RAF、样式计算及 Paint trace 来自无头浏览器，不代表物理显示器帧率。

最终 5 次主题测量的最大帧间隔约为 33.4 ms，但前面的重复测量仍出现过约 50 ms，不能据此宣称已经消除卡顿。公开 Watch 启动探针的布局偏移约为 0.1497，仍包含原生播放器及控件的变化；本次主要减少观察器工作，没有宣称消除这部分偏移。

## 验证结果

- `node --test tests/*.test.js`：255 项全部通过。
- `node scripts/verify.mjs`：Manifest、27 个资源、22 个 JavaScript 文件语法及架构检查通过。
- `git diff --check`：通过。
- 性能 fixture：验证卡片、图片实例保留、元数据更新、Shelf 插入和移除、重复视频键、跨页列表刷新、Watch 晚到区域、Vue 类名恢复、原生 Header 恢复、抽屉及焦点保留。
- `media_continuity_smoke.py`：预览连续播放、主题快速反转、动效关闭、图片及视频不重复加载、后台预览释放、原生视频连续性通过。
- `refresh_experience_smoke.py`：刷新、重试、旧请求隔离、搜索及 IME、空列表、Shelf 滚动、久置更新提示和 390 px 布局通过。
- `watch_navigation_probe.py --clicks 2`：使用临时未登录配置访问公开 Bilibili，连续两次推荐视频跳转均为同文档导航；三个页面的播放器都保持在标题上方，视频处于播放状态，`readyState=4`。

登录态下的私人数据和写操作未做生产验收。浏览器 fixture 不替代真实账号验收。

## 复测

```powershell
node --test tests/*.test.js
node scripts/verify.mjs
git diff --check
python scripts/performance_audit.py --output output/performance-audit/report.json
python scripts/media_continuity_smoke.py
python scripts/refresh_experience_smoke.py
python scripts/watch_navigation_probe.py --clicks 2
```

性能探针依赖 Python Playwright，默认使用本机 Edge；可通过 `--browser` 指定 Chromium 可执行文件。比较旧源码时，使用 `--source-dir <源码快照目录> --measure-only --output <结果路径>`；该模式记录旧版本的行为缺陷，默认模式则对行为和确定性的工作量检查失败报错。进行时间对比时应依次运行，关闭其他性能探针。

本次本地原始数据位于 `output/performance-audit/baseline-final.json`、`output/performance-audit/optimized-final.json`。公开页面结果位于 `output/performance-watch-navigation-final/report.json` 和 `output/performance-watch-startup/report.json`。`output/` 为忽略目录，不随源码发布。

## 资源分配与视频加载（2026-11-01）

这一轮只动三类开销：**图片请求字节数**、**Hover Preview 取流的额外往返**、**预览结果的重复查询**。所有数字由 `python scripts/resource_audit.py` 复现。

### 缩略图与头像按实际显示尺寸取图

卡片封面槽位最宽约 320 CSS px，此前直接请求 API 返回的原图（1000×625 甚至更大）。现在由 `ui.js::sizedImage()` 追加 Bilibili 图床的 `@Ww_Hh_1c.webp` 变体，头像同理；失败一次会回退到原 URL，不会因为 CDN 拒绝变体而丢图。

| 资源 | 原图 | 变体 | 变化 |
| --- | ---: | ---: | ---: |
| 封面样本 1 | 42,267 B / 1000×625 | 11,086 B / 672×378 | 字节 −73.8%，像素 −59.3% |
| 封面样本 2 | 80,325 B / 1692×952 | 9,158 B / 672×378 | 字节 −88.6%，像素 −84.2% |
| 封面样本 3 | 150,842 B / 1668×938 | 23,046 B / 672×378 | 字节 −84.7%，像素 −83.8% |
| UP 主头像 | 83,086 B / 694×694 | 2,874 B / 96×96 | 字节 −96.5%，像素 −98.1% |

按这三个封面样本的均值，单张封面 91.1 KB → 14.4 KB。一屏 12 张互不重复的卡片（封面 + 头像）约 2.1 MB → 0.21 MB；同一批图片如果都保持在解码缓存里，位图从约 50 MB 量级降到约 12 MB。变体可用性已用真实浏览器与 CDN 双向校验：三个封面与一个头像都返回 `200 image/webp`，`naturalWidth/naturalHeight` 正好是请求的 672×378 与 96×96；带旧 `@` 修饰符、带查询串、`bfs/face/` 目录三种形式都正常。

### Hover Preview 少一次往返

旧实现先 `x/web-interface/view` 取 `cid`，再 `x/player/playurl` 取流地址。现在：

1. 首页 / 热门 / 分类的列表项本身就带 `cid`（`data.js` 保留该字段），预览直接带 `cid` 请求，**一次往返**即可拿到流地址。
2. 列表没有 `cid` 时（搜索、动态等）改用 `x/player/pagelist`，响应体约为 `view` 的 1/3，`view` 仅作为最后兜底。
3. 同一个 BV 的空结果（无预览流）缓存 30 s，URL 结果缓存 150 s（不超过 service worker 里 `playurl` 的 180 s TTL）。

| 项目 | 数值 |
| --- | --- |
| 6 个样本的 `view` 响应合计 | 969,460 B（单条最大 105 KB） |
| 同 6 个样本的 `pagelist` 合计 | 2,550 B（−99.7%） |
| 带 `cid` 时的取流查询 | 0 字节（只剩 `playurl`） |

### 试过但没有上线的优化

`content-visibility:auto` 的另一套「按列表长度启用」规则：在无头 Chromium 中 500 张卡片的挂载与首次布局没有可重复收益（5 次采样：134.5 ms 对 123.1 ms，且 `checkVisibility({contentVisibilityAuto:true})` 显示没有任何卡片被跳过），因此没有加入仓库；既有的 feed 级规则保持不变。这项优化的代价是滚动条稳定性与页内查找可用性，缺少真实浏览器证据时不应扩大范围。

### 回归基线（500 张卡片，无头 Chromium）

| 指标 | 中位数 |
| --- | ---: |
| `shell.ensure + render` 同步耗时 | 15–17 ms |
| 首次强制布局 | 112–115 ms |
| `#bilitube-outlet` 节点数 | 8,016 |
| JS 堆 | 10 MB |

这三项作为回归守卫：节点数和挂载耗时不应随改动上升。布局毫秒数在无头环境下波动较大，只用于发现数量级回退。

### 复测

```sh
python scripts/resource_audit.py --runs 3
node --test tests/resource-budget.test.js
node --test tests/*.test.js
```

该脚本不依赖 Playwright：图片与接口部分直接向真实 CDN / API 发请求（离线时自动跳过），布局部分用本机 Chrome/Edge 无头模式运行。登录态下的播放与预览起播时间仍需人工按 `docs/TESTING.md` 验收。

## 首屏请求与首页分类（2026-11-02）

- 在页面主体尚未出现时，先检查扩展设置和路由，提前开始首页全部推荐、搜索、动态、稍后再看或空间投稿的首个列表读取。页面外壳、原生节点隐藏和 DOM 修改仍按原来的 `DOMContentLoaded` 时机执行。挂载时只复用同一路由、同一组参数的成功结果；路由改变会取消等待，失败或超过 10 秒的数据会在挂载时重新读取。原网页响应仍有 250 ms 优先等待时间，提前读取可能使扩展回退请求比原网页响应更早发出，因此在部分加载顺序下会增加一次并行读取。
- 首页专题按启用状态读取并分别缓存。直播、番剧分类分别只读取对应专题；科技等普通分类只读取相应分类接口，失败且没有可用推荐时才回退读取首页推荐。启用先前关闭的专题时会补取数据；手动刷新仍会请求新数据。
- `scripts/performance_audit.py` 的搜索数据补充了非空关键词，并移除了已改为原生适配的历史页面，使该探针与当前页面行为一致。

在无头 Edge 156.0.4314.58 中，用 `scripts/startup_performance_probe.py` 加载相同的模拟首页：原网页延迟脚本固定约 1,200 ms，扩展接口响应模拟 350 ms，原网页不提供可复用的数据。前后各连续运行 5 次，数值为中位数：

| 指标 | 修改前 | 修改后 |
| --- | ---: | ---: |
| `DOMContentLoaded` | 1,281 ms | 1,282 ms |
| 外壳创建 | 1,380 ms | 1,397 ms |
| 第一张真实卡片插入 DOM | 2,052 ms | 1,496 ms |

这组数据只说明请求与延迟脚本重叠时的效果；卡片时间不是首次绘制或真实网络下的加载时间。该修改并未提前挂载外壳，实际收益取决于网页脚本、原生数据和网络响应时序。

在临时未登录扩展配置下访问真实 Bilibili 首页、科技及直播分类，三页均显示内容且未记录到页面脚本异常。科技分类的扩展后台读取记录中只出现分类排行、账号及订阅接口；直播分类复用了此前缓存。登录态私人数据和写操作未做生产验收。

复测命令：

```powershell
python scripts/startup_performance_probe.py --runs 3
python scripts/performance_audit.py --runs 3
python scripts/refresh_experience_smoke.py
python scripts/feature_parity_smoke.py
python scripts/media_continuity_smoke.py
node --test tests/*.test.js
node scripts/verify.mjs
```

本次模拟基线和修改后原始结果分别记录在 `output/startup-performance/baseline-final.json`、`output/startup-performance/optimized-final.json`；该目录由 Git 忽略。
