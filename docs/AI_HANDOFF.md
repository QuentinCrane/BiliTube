# BiliTube Maintainer Handoff

这份文档给下一位维护者或 AI 助手使用。它只记录可以公开的仓库上下文，不包含登录态、Cookie、个人路径日志或真实账号数据。

## Current project

- Project: BiliTube
- Repository: `https://github.com/QuentinCrane/BiliTube`
- Extension version: `0.12.4`
- Manifest: Manifest V3
- Main branch: `main`
- License: MIT
- Copyright attribution: `QuentinCrane`
- Citation file: `CITATION.cff`

## Recent commits

- `8a55242` — keep loaded thumbnails stable across feed rerenders
- `64a5feb` — add GitHub project documentation
- `9d23860` — restore attribution-friendly MIT license and add citation metadata

## Product boundary

BiliTube 是 Bilibili 的视觉和信息架构层。必须保留：

- Bilibili 原生播放器和播放控制；
- 原生 toolbar 及点赞/投币/收藏/分享/三连弹窗；
- 原生简介、评论、评论输入和相关推荐；
- 普通链接的浏览器默认导航；
- History、直播、番剧、账号等复杂页面的原生业务 DOM。

不要重新实现这些业务，也不要把它们移动到 BiliTube 自建的 slot 或代理事件系统中。

## Source map

| 文件 | 责任 |
| --- | --- |
| `manifest.json` | Manifest V3 入口、权限、脚本加载顺序 |
| `src/background.js` | service worker、Bilibili API、WBI、短期缓存 |
| `src/page/bridge.js` | MAIN-world 路由和原生状态桥接 |
| `src/page/preflight.js` | document_start Watch 几何预布局 |
| `src/core/policy.js` | URL 到 route/strategy 的映射 |
| `src/core/app.js` | 运行时状态、挂载、请求竞态和分页 |
| `src/core/data.js` | API payload 归一化 |
| `src/core/ui.js` | DOM factory、页面 renderer、渐进式图片 |
| `src/core/shell.js` | Header、Sidebar、route outlet |
| `src/core/preview.js` | Hover Preview observer、media 和 seek rail |
| `src/core/watch.js` | Native-first Watch 区域发现和装饰 |
| `src/core/native-adapter.js` | 复杂页面的外层适配 |
| `src/options/` | 设置页与 `chrome.storage.local` |
| `tests/` | 静态契约、数据、路由、生命周期和回归测试 |

## Important invariants

### Native-first Watch

普通 `/video/BV...` 使用 `decorate`。可以调整布局、颜色、间距和外层作者镜像，但不要：

- 移动、克隆或替换播放器、toolbar、评论和相关推荐；
- 进入评论 Shadow DOM；
- 合成 Bilibili 原生互动事件；
- 对关键左右栏使用 `display: contents`。

### Async cancellation

新请求必须考虑路由切换、同 feed 重复请求、扩展禁用/恢复和 Shell 重绘。`app.js` 当前通过 route generation、URL 和 API key sequence 丢弃过期响应。

### Thumbnail continuity

`ui.js` 中的 `imageLoadStates` 只保留当前页面生命周期内已完成图片的 URL 状态。它解决视觉闪烁，不是磁盘缓存，也不应扩展成私自保存媒体文件的系统。

### Real navigation

BiliTube 创建的普通卡片和导航使用真实 `<a href>`。局部按钮可以处理自身点击，但不要全局阻止普通链接。

## Verification

```powershell
node --test tests/*.test.js
node --test tests/interaction-state.test.js
node scripts/verify.mjs
git diff --check
```

当前自动测试通过并覆盖 205 项。真实 Bilibili 页面仍要在当前 Edge/Chrome 中重新确认，尤其是：

1. 首页无限滚动时旧图片保持清晰；
2. Watch 原生播放器、toolbar、评论和相关推荐；
3. 搜索、动态、收藏夹和频道分页；
4. 宽屏、网页全屏、浏览器真全屏和 mini-player；
5. 扩展关闭以及 `bilitube_native=1` 的恢复。

## Public docs and screenshots

- `README.md`：项目首页、截图和快速开始；
- `docs/TECHNICAL_OVERVIEW.md`：产品与页面能力；
- `docs/ARCHITECTURE.md`：模块和生命周期；
- `docs/BUILD_GUIDE.md`：安装、验证和发布压缩包；
- `docs/TESTING.md`：测试层级与人工验收；
- `docs/PRIVACY.md`：权限和数据边界；
- `docs/GITHUB_PUBLISHING.md`：公开仓库清单；
- `docs/RELEASE_NOTES.md`：Release 文案草稿；
- `docs/screenshots/`：当前四张页面截图和后续补图清单。

## Next recommended work

1. 在真实浏览器中完成当前 `PAGE_AUDIT.md` 的实机验收。
2. 维护现有四张公开截图与当前页面实现的一致性。
3. 将 Node 测试和 `scripts/verify.mjs` 接入 GitHub Actions。
4. 公开仓库后检查 README 图片、CITATION.cff、LICENSE 和相对链接。
5. Bilibili DOM/API 变化时，先补脱敏 fixture 和回归测试，再修改运行时。

## Do not commit

- Cookie、token、浏览器 profile；
- `output/`、`artifacts/`、`.playwright-cli/`；
- 真实账号历史、私信、动态草稿和未脱敏截图；
- 本机路径日志；
- Bilibili API 的完整个人响应；
- 任何 release keystore 或密码。
