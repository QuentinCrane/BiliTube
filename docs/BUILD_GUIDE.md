# BiliTube Build and Release Guide

BiliTube 当前是“源码即扩展”的项目：没有 npm 构建产物，也没有必须执行的 bundler。开发和发布的核心动作是校验源码，然后把包含 `manifest.json` 的目录作为未打包扩展加载。

## Requirements

- Windows 上推荐 Chrome 或 Edge；其他 Chromium 浏览器需要支持 Manifest V3。
- Node.js 18+，用于 `node:test`、语法检查和 `scripts/verify.mjs`。
- Git 2.x（开发和提交时使用）。

扩展运行时本身不需要 Node.js。Node.js 只用于维护者的测试和静态验证。

## Get the source

```powershell
git clone https://github.com/QuentinCrane/BiliTube.git
Set-Location BiliTube
```

## Load the unpacked extension

1. 打开 `chrome://extensions` 或 `edge://extensions`。
2. 开启右上角“开发者模式”。
3. 选择“加载已解压的扩展”。
4. 选择仓库根目录，而不是 `src`、`assets` 或 `output` 子目录。
5. 打开 Bilibili 首页，搜索页和一个普通 `/video/BV...` 页面。

Manifest 入口和资源关系由 [`scripts/verify.mjs`](../scripts/verify.mjs) 检查。扩展使用 `document_start` 内容脚本，因此更新本地文件或重新加载扩展后，最好关闭并重新打开已经存在的 Bilibili 标签页。

## Development loop

推荐每次修改都按下面的顺序执行：

1. 先阅读对应模块和已有回归测试。
2. 修改最小范围的源文件。
3. 先运行受影响的测试，再运行全套测试。
4. 运行 Manifest/语法/架构校验。
5. 重新加载扩展并进行真实页面验收。
6. 在 `CHANGELOG.md` 或 Pull Request 中区分自动证据和实机证据。

### Test commands

```powershell
# 单个生命周期/交互回归
node --test tests/interaction-state.test.js

# 全部回归测试
node --test tests/*.test.js

# Manifest 资源、语法、主题、路由和 Native-first 边界
node scripts/verify.mjs
```

当前仓库没有 `npm install`、`npm run build` 或锁文件要求。不要为了运行现有测试临时创建 `package.json`。

## Browser acceptance

自动测试通过后，至少在一个当前版本的 Chrome 或 Edge 中确认：

### Core pages

- 首页能够加载卡片、Shelf、分类 Chips，并且向下滚动后已有图片不会再次模糊。
- 搜索建议、综合结果、视频 Tab、用户 Tab 和真实链接均可用。
- Dynamic、Watch Later、Favorites 和 Space 投稿可以连续分页。
- 主题、侧栏折叠、设置页和已打开页面的设置同步正常。

### Native-first Watch

- 播放器播放/暂停、音量、弹幕、进度条和画质入口仍然是 Bilibili 原生行为。
- 点赞、投币、收藏、分享、三连和评论不经过 BiliTube 代理。
- 相关推荐保留原生卡片和链接；中键和 Ctrl/Command 点击仍符合浏览器行为。
- 普通、宽屏、网页全屏、浏览器真全屏和 mini-player 的几何互不误伤。

### Fallbacks

- 在未登录状态打开历史、动态、稍后再看和收藏夹，页面不会因为 API 空响应而白屏。
- 使用 `?bilitube_native=1` 后，BiliTube 能移除自己的状态并恢复原生页面。
- 在扩展设置中关闭 BiliTube 后，页面能恢复 Bilibili 原生内容。

完整动作表见 [`PAGE_AUDIT.md`](../PAGE_AUDIT.md)。

## Release preparation

发布前检查：

1. `manifest.json` 的 `version`、名称、描述和图标资源正确。
2. `node --test tests/*.test.js` 通过。
3. `node scripts/verify.mjs` 通过。
4. `git diff --check` 没有空白错误。
5. 手动验收中所有“实机”项目有记录；未验证项目不要写成“已支持”。
6. README、CHANGELOG、隐私说明和截图与当前源码一致。
7. 压缩包中包含 `manifest.json`、`src/`、`assets/` 和运行所需文件，不包含 `output/`、`.playwright-cli/`、测试缓存、个人配置或登录信息。
8. 解压发布包到全新目录后，再走一遍“加载已解压的扩展”流程。

## Suggested packaging on Windows

下面的示例只复制当前仓库的发布所需目录。执行前请把版本号替换成 `manifest.json` 中的实际值，并确认目标目录是专门的发布目录：

```powershell
$release = Join-Path (Get-Location) 'release\BiliTube-v0.12.4'
New-Item -ItemType Directory -Force -Path $release | Out-Null
Copy-Item manifest.json,LICENSE,README.md,CHANGELOG.md,PAGE_AUDIT.md -Destination $release
Copy-Item assets,src -Destination $release -Recurse
Compress-Archive -Path (Join-Path $release '*') -DestinationPath (Join-Path (Split-Path $release) 'BiliTube-v0.12.4.zip') -Force
```

这是一个可读的发布示例，不是仓库的构建脚本；如果项目以后增加正式 release 脚本，应让脚本复用同一份清单并加入独立的干净目录验证。

## Troubleshooting

### 扩展加载失败

- 确认选择的是仓库根目录。
- 确认 `manifest.json` 是合法 JSON，且 `node scripts/verify.mjs` 通过。
- 如果只修改了 `src` 中的文件，不要把 `src` 当作扩展根目录加载。

### 页面仍然是原版 Bilibili

- 确认扩展已启用，且“启用 BiliTube”没有关闭。
- 关闭旧 Bilibili 标签页再重新打开。
- 检查 URL 是否命中了支持的路由；History、直播、番剧等页面默认走 `adapt`，不会被完整替换。
- 检查是否带有 `bilitube_native=1`。

### 页面没有数据

- 先确认 Bilibili 当前页面可正常访问。
- 未登录时，历史、动态、订阅、稍后再看和收藏夹为空是可能的。
- 检查扩展详情页的 service worker 错误；不要把用户的 Cookie、完整请求头或个人响应直接贴到 Issue。
- Bilibili 接口或 WBI 字段发生变化时，应先增加最小化的脱敏响应样本，再修改归一化逻辑。

### 图片加载出现异常

- 先确认是网络/CDN 失败，还是已加载图片在分页重绘时重新变糊。
- 对后者优先检查 `core/ui.js` 的 `imageLoadStates`、`core/app.js` 的 route generation 和 `tests/interaction-state.test.js`，不要只通过加长动画时间掩盖问题。
- 真实页面中应记录 URL、滚动动作和是否发生路由切换；不要上传带个人信息的完整页面截图。

## Evidence language

发布说明中请明确区分：

- “静态测试通过”：只表示源码契约和 Node.js 测试通过。
- “扩展成功加载”：表示浏览器扩展管理页接受了当前目录。
- “真实页面验收通过”：表示在指定浏览器、指定登录态和当前 Bilibili 页面上实际执行过动作。

除非真的完成了最后一项，不要把自动测试结果写成生产页面已验证。
