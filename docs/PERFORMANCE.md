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

## 批量更新与分页动效（2026-11-09）

- Watch 的 MutationObserver 按一次交付合并新增子树：播放器模式、失效标记和作者区每批只检查一次。每个新增子树仍会查找原生区域，新的 `#app` 也会重新接入观察，播放页宽屏切换和原生区域替换仍可恢复。
- 分页渲染直接把本次新增卡片交给动效层，避免在追加前后分别遍历全部卡片。新增卡片的动画数量上限、预览播放时的保护和原有卡片、图片实例保留。

在同一台机器的无头 Edge 157.0.4341.42 中，使用 `scripts/performance_audit.py` 的固定数据和 1920 × 1080 视口分别运行修改前、修改后的代码。对比使用提交 `41e8315` 的源码快照；优化快照只替换本次修改的四个核心脚本，样式和其他文件保持相同：

| 场景 | 修改前 | 修改后 |
| --- | ---: | ---: |
| 一批 200 个评论节点及一个延迟出现的推荐区域引发的 DOM 查询 | 1,206 | 205 |
| 500 张卡片后追加 30 张时，动效前后查询匹配到的 `article` 总数 | 1,030（500 + 530） | 0 |

两项是 fixture 中的确定性工作量计数，不代表整页耗时或实际帧率；分页同步耗时的单次测量为 18.0 → 18.2 ms，样本不足以证明耗时改善。测量同时验证了原有卡片和图片未替换、只对新增卡片播放动效、播放页区域延迟加载、原生 `#app` 替换以及宽屏往返后的观察器恢复。主题探针的两组采样中最大帧间隔分别约为 62.6 ms 和 83.4 ms，主题卡顿尚未解决。

验证通过：306 项 Node 测试、`node scripts/verify.mjs`、`git diff --check`，以及 `feature_parity_smoke.py`、`refresh_experience_smoke.py`、`media_continuity_smoke.py` 和性能探针。临时未登录配置访问公开 Bilibili 视频，连续两次同文档推荐跳转后播放器均在标题上方并保持播放；登录态私人数据和写操作未验收。

```powershell
python scripts/performance_audit.py --runs 3 --output output/razor-20261109/report.json
python scripts/feature_parity_smoke.py
python scripts/refresh_experience_smoke.py
python scripts/media_continuity_smoke.py
python scripts/watch_navigation_probe.py --clicks 2
node --test tests/*.test.js
node scripts/verify.mjs
```

本次原始结果位于忽略目录 `output/razor-20261109/`；比较旧版本时可用 `--source-dir` 和 `--measure-only`。旧版本没有动效模块时，分页动效场景会标记为跳过。

## 首页长列表与分类首屏（2026-11-09）

首页刷新或专题到达时，同路由重排动效此前会读取全部卡片的位置。现在复用预览组件已有的 IntersectionObserver 可见性状态，跳过已知远离视口的卡片，不另建观察器；未绑定预览、观察结果尚未到达或关闭预览时仍按原方式测量。观察结果可能短暂滞后于快速滚动，此时可能跳过一次卡片动画，但不影响内容更新。

使用同一份样式和数据的前后源码快照，在无头 Edge 157.0.4341.42、1920 × 1080、设备缩放 2 的 500 卡片首页上，分别滚动到顶部、中部和底部后各刷新 5 次：

| 位置 | 卡片位置读取次数（前 → 后） | 同步刷新耗时中位数（前 → 后） |
| --- | ---: | ---: |
| 顶部 | 516 → 32 | 6.5 → 7.1 ms |
| 中部 | 520 → 44 | 7.0 → 3.5 ms |
| 底部 | 512 → 28 | 27.8 → 20.8 ms |

耗时包含其他渲染工作，样本和机器负载会造成波动；这组数据不能代表真实帧率，也不表示每次刷新都会更快。探针验证了顶部可见卡片重排、动画自然结束、图片实例保留，以及关闭预览后的测量回退。

首页的科技等普通分类以及直播、番剧分类，现在也可在 `DOMContentLoaded` 前开始首个分类请求，并在挂载时复用成功响应；关闭相应专题时不发预读，失败会重试，导航或设置变化会释放等待。模拟原网页延迟脚本 1,200 ms、接口响应 350 ms 的 3 次采样中，科技分类第一张卡片插入 DOM 的中位时间为 1,747 → 1,500 ms，直播分类为 1,772 → 1,451 ms。这仅说明模拟条件下的请求重叠效果，不代表真实网络或首次绘制时间；已经发出的后台请求无法随路由取消底层网络。

312 项 Node 测试、项目自检、首页性能和首屏夹具、刷新/媒体连续性/多页面功能回归通过。临时未登录浏览器访问真实首页的全部、科技、直播和番剧分类均加载出卡片。仓库既有 `motion_smoke.py` 在本机虚拟时间模式下的 `clearedAfter` 和 `leftoverTransform` 两项在修改前后均失败；首页实时浏览器探针中同类重排动画可正常结束。

```powershell
python scripts/homepage_performance_probe.py --runs 5
python scripts/startup_performance_probe.py --category tech --runs 3
python scripts/startup_performance_probe.py --category live --runs 3
python scripts/media_continuity_smoke.py
python scripts/refresh_experience_smoke.py
node --test tests/*.test.js
node scripts/verify.mjs
```

本次源码快照和原始结果位于忽略目录 `output/homepage-performance/`。

## 全页面暴力压测与 reconcile 热路径（2026-11-09）

新增 `scripts/perf_stress.py`：对全部渲染管线做大样本量压测——首页 500 卡片连续 50 次同路由重渲染、1000 卡片连续 100 次重渲染，搜索 300 行、动态 230 条、稍后再看 / 收藏 / 空间各 200 条各 30 次重渲染，Watch 播放页 10 批 × 200 评论节点与 50 次 Vue 类名改写，原生适配页 50 次 Chrome 更新与 10 批插入，预览 500 卡绑定销毁 × 10，以及 500 节点 DOM 提取。每场景记录同步墙钟时间与确定性工作量计数（`createElement`、`querySelector(All)`、`matches`、`getBoundingClientRect`）。观察器类场景用微任务冲刷测量，避免 `setTimeout` 延迟混入。

本轮改动集中在同路由重渲染热路径：

- `reconcile.js`：diff 时顺手收集待恢复的延迟缩略图与待绑定的预览节点，去掉收尾对整棵连接树的两次 `img`/`article` 全扫描；复用图节点在属性同步时补拷暂存的 `__btDeferredSrc`；`createReuse` 的复用键改为三层 Map 嵌套。
- `ui.js`：`cardSignature` 按条目对象缓存（WeakMap），同一批数据的后续渲染不再逐卡重新序列化；搜索行详情补充（原地变更条目后调用 `updateSearchRow`）会先作废缓存。`markCard` 的图片键改用字符串切片解析，去掉每卡一次 `new URL`。
- `watch.js`：类名观察器恢复缺失标记时不再走完整区域发现与观察器重建；`ensureAuthorRow` 的未变化快速路径提前到主列查询之前，评论批次每批少 4 次选择器查询。

同时修复一个缩略图更新缺陷：同一卡片封面变更时，复用的 `img` 节点会同步暂存节点的属性集（不含 `src`），延迟来源又留在被丢弃的暂存节点上，结果 `src` 被清掉且无人恢复。现在延迟来源会随属性同步拷贝到复用节点，压测中的 `home_thumbnail_change` 场景在基线上失败（`src=null`）、修复后通过。

在无头 Edge 157.0.4341.42、1920 × 1080、设备缩放 2 下，对同一份夹具分别运行优化前后源码快照（`--source-dir`），每场景迭代取中位数：

| 场景 | 修改前 | 修改后 |
| --- | ---: | ---: |
| 500 卡首页同内容重渲染 | 5.7 ms | 3.25 ms |
| 500 卡首页单条元数据变化 | 6.55 ms | 5.9 ms |
| 500 卡首页封面变化 | 失败（src 丢失） | 4.35 ms |
| 500 卡首页 Shelf 插入/移除 | 14.0 ms | 12.75 ms |
| 1000 卡首页连续 100 次重渲染 | 13.65 ms | 8.55 ms |
| 搜索 300 行重渲染 | 5.85 ms | 3.15 ms |
| 动态 230 条重渲染 | 2.6 ms | 1.5 ms |
| 稍后再看 200 行重渲染 | 2.0 ms | 1.1 ms |
| 收藏 200 卡重渲染 | 2.15 ms | 1.4 ms |
| 空间 200 卡重渲染 | 2.1 ms | 1.45 ms |
| Watch 每次 Vue 类名改写的查询 | 31 | 0 |

各重渲染场景的 `querySelector(All)` 计数从 7–8 降到 5–6（收尾两次全树扫描消失）。Watch 评论批（200 节点）仍为每批约 204 次查询，与既有预算持平；提取回退路径的 898 次查询未动。首页冷启动（约 8,100 个节点创建）与分页追加无明显变化。单次测量有波动，表中差距小的行（元数据、Shelf、封面）不足以宣称稳定收益。

验证：312 项 Node 测试、`node scripts/verify.mjs`、`git diff --check`，`scripts/performance_audit.py --runs 3` 的卡片与图片保留、重复键、Watch 晚到区域与类名恢复、宽屏往返、分页动效断言全部通过（同内容刷新中位数 3.5 ms，封面/图片实例保留正常）。登录态与真实网络下的交互响应未做生产验收。

```powershell
python scripts/perf_stress.py --output output/perf-stress/report.json
python scripts/perf_stress.py --source-dir <源码快照目录> --measure-only --output <结果路径>
python scripts/performance_audit.py --runs 3
node --test tests/*.test.js
node scripts/verify.mjs
```

原始数据位于忽略目录 `output/perf-stress/`（`baseline.json`、`optimized.json` 及源码快照）。
