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
