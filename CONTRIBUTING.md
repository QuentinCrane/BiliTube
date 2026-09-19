# Contributing to BiliTube

感谢你愿意改进 BiliTube。这个项目是一个“视觉层 + 原生兼容”扩展，贡献时最重要的是保持页面能力和边界清楚，而不是把 Bilibili 重新实现一遍。

## Before opening an issue

请先确认问题是否已经出现在：

- 当前仓库的 [`CHANGELOG.md`](CHANGELOG.md)；
- [`PAGE_AUDIT.md`](PAGE_AUDIT.md) 的人工验收清单；
- Bilibili 原生页面本身，而不是 BiliTube 外层；
- 登录状态、地区、广告拦截器、其他扩展或浏览器版本造成的环境差异。

Bug 报告至少应包含：

1. Chrome/Edge 版本和操作系统。
2. BiliTube commit 或版本号。
3. 具体 URL 类型，例如首页、搜索、`/video/BV...`、History 或 Space。
4. 登录/未登录状态和可复现动作。
5. 预期行为、实际行为和是否每次发生。
6. 已经运行过的测试命令或控制台错误摘要。

不要提交 Cookie、完整请求头、个人历史、私信、账号二维码或未脱敏截图。

## Local setup

```powershell
git clone https://github.com/<owner>/BiliTube.git
Set-Location BiliTube
node --test tests/*.test.js
node scripts/verify.mjs
```

然后按照 [`docs/BUILD_GUIDE.md`](docs/BUILD_GUIDE.md) 将根目录作为未打包扩展加载到 Chrome/Edge。

## Change boundaries

### Preserve Bilibili ownership

普通 Watch 页面中不要：

- 移动、克隆或替换播放器、原生 toolbar、简介、评论和相关推荐；
- 创建自制点赞、投币、收藏、分享、三连按钮代理 Bilibili；
- 对 Bilibili 原生互动合成 `click`、`pointer` 或 mouse 事件；
- 进入评论 Shadow DOM 内部重建或改写评论；
- 用 `display: contents` 扁平化核心 `.left-container`、`.right-container` 或 `.right-container-inner`。

如果需求需要改变播放器或评论内部行为，应先讨论是否属于 BiliTube 的职责边界。

### Preserve browser navigation

由 BiliTube 创建的普通入口应使用真实 `<a href>`。除非是按钮自身的局部动作（例如“稍后再看”），不要通过全局 click 拦截来接管普通链接。这样才能保留刷新、打开新标签、中键、Ctrl/Command 点击和浏览器历史行为。

### Keep async state cancellable

新增 API 请求或分页状态时，要考虑：

- 用户在请求完成前切换了路由；
- 同一个 feed 的新请求已经开始；
- 页面正在被扩展禁用或恢复原生；
- Shell 即将重绘，旧节点的 observer 和事件是否已经释放。

旧响应不能覆盖新路由。新卡片不能因为整页重绘而让已经稳定的缩略图重新进入模糊状态。

## Code style

- 保持现有的浏览器原生 JavaScript 和 IIFE/module-wrapper 结构；不要为了小改动引入构建依赖。
- 原始 Bilibili payload 在 `background.js` 读取，在 `core/data.js` 归一化，再交给 renderer。
- UI renderer 接收规范化数据，不直接依赖 API 的偶然字段排列。
- 需要重复运行的 observer、timer、event listener 必须有对应的清理路径。
- 新增设置时同时更新默认值、设置页、运行时读取、主题/行为应用和文档。
- 不把实机尚未验证的行为写成稳定支持；在 PR 描述中区分自动和人工证据。

## Tests

提交前运行：

```powershell
# 受影响的测试
node --test tests/interaction-state.test.js

# 全部测试
node --test tests/*.test.js

# 仓库级校验
node scripts/verify.mjs

# 空白检查
git diff --check
```

如果修改了页面布局或交互，还应在真实浏览器中执行 [`PAGE_AUDIT.md`](PAGE_AUDIT.md) 中对应项目。Node.js 测试不能证明当前 Bilibili 生产页面的 DOM 和接口仍然一致。

## Pull requests

建议一个 Pull Request 只解决一个主题，并在描述中写清楚：

- 问题和根因；
- 修改了哪些文件以及为什么；
- 是否改变了路由、API、权限、设置或原生 DOM 归属；
- 自动测试命令和结果；
- 实机浏览器、页面、登录态和动作结果；
- 尚未验证的内容或已知限制。

提交说明建议使用简短的 Conventional Commit 风格，例如：

```text
fix: keep loaded thumbnails stable across feed rerenders
feat: add a channel shelf
docs: explain native-first watch boundaries
test: cover route generation cancellation
```

## Review checklist

提交前可以逐项确认：

- [ ] 没有覆盖工作区中与本次任务无关的修改。
- [ ] 代码没有引入新的网站级导航拦截或原生节点搬运。
- [ ] 异步请求、timer、observer 和 preview 绑定都有清理/竞态保护。
- [ ] 对应的回归测试已经补充或说明为什么不能自动化。
- [ ] `node --test tests/*.test.js` 通过。
- [ ] `node scripts/verify.mjs` 通过。
- [ ] 文档、CHANGELOG 和设置说明与实际源码一致。
- [ ] 没有提交账号信息、构建缓存、截图中的敏感数据或本机路径。
