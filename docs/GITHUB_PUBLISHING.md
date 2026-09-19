# GitHub Publishing Guide

这份清单用于把 BiliTube 从本地工作区发布到公开 GitHub 仓库 `https://github.com/QuentinCrane/BiliTube`。它重点检查文档、截图、扩展权限、测试证据和不应公开的本地文件。

## Recommended public structure

```text
.
├── assets/                 扩展图标
├── docs/                   产品、架构、构建、测试、隐私和发布文档
│   └── screenshots/        README 和文档截图
├── scripts/                静态验证与 smoke 脚本
├── src/                    Manifest V3 service worker、页面桥接和核心运行时
├── tests/                  Node.js 回归和静态契约
├── README.md               GitHub 首页文档
├── CONTRIBUTING.md         贡献指南
├── SECURITY.md             安全报告说明
├── LICENSE                MIT License 与 QuentinCrane 署名
├── CITATION.cff            GitHub/论文引用信息
├── PAGE_AUDIT.md           人工验收矩阵
└── manifest.json           扩展入口
```

## Before staging

不要直接把整个工作目录拖到 GitHub 网页上传。先检查 Git 状态和忽略文件：

```powershell
git status --short --ignored
git check-ignore -v output/ artifacts/ .playwright-cli/
```

确认没有进入暂存区的内容：

- `output/`、`artifacts/`、`.playwright-cli/`；
- 浏览器 profile、调试日志和本机截图临时目录；
- Cookie、token、个人请求响应或账号导出；
- 未脱敏的历史记录、私信、动态草稿和个人推荐数据；
- 本机路径、临时构建目录和个人配置；
- 未经确认的第三方截图、视频或受版权保护的素材。

公开截图应只放入 `docs/screenshots/`，并在 README 或截图清单中说明其用途和状态。

## Verification before first push

```powershell
node --test tests/*.test.js
node scripts/verify.mjs
git diff --check
```

然后至少在 Chrome 或 Edge 中完成：

1. 加载仓库根目录作为未打包扩展。
2. 打开首页、搜索、动态和普通视频页面。
3. 检查首页分页时旧缩略图是否保持清晰。
4. 检查普通链接、播放器、评论和原生 toolbar。
5. 检查关闭扩展和 `bilitube_native=1` 的恢复路径。

测试结果要区分“Node 测试通过”和“真实 Bilibili 页面验收通过”。

## Repository settings

建议 GitHub 仓库 About 设置：

- Description：`A YouTube Desktop-inspired visual layer for Bilibili.`
- Topics：`bilibili`、`browser-extension`、`chrome-extension`、`edge-extension`、`manifest-v3`、`javascript`、`youtube-desktop`
- License：MIT
- 开启 Issues；如果准备接收贡献，再开启 Discussions。
- 开启 Actions 后，将 Node 测试和 `scripts/verify.mjs` 加入 CI。

仓库默认分支建议保持 `main`，外部贡献使用 Pull Request。不要在公开仓库中保存个人 Bilibili 登录态或真实账号数据。

## First push

本地 remote 应指向：

```text
https://github.com/QuentinCrane/BiliTube.git
```

常规推送命令：

```powershell
git push -u origin main
```

推送后检查：

1. GitHub 首页 README 图片和相对链接是否正常显示。
2. `docs/screenshots/` 四张图片是否可以打开。
3. LICENSE 是否被 GitHub 识别为 MIT。
4. `CITATION.cff` 是否可以被 GitHub 的引用入口识别。
5. README 中的安装命令、版本号、页面能力与当前源码一致。
6. 仓库中没有意外出现 `C:\Users\...`、`E:\Github Program\...` 等本机路径。

## Release contents

BiliTube 是加载解压扩展，不需要编译 JavaScript。发布压缩包应包含：

- `manifest.json`；
- `assets/`；
- `src/`；
- README、LICENSE、CHANGELOG、PAGE_AUDIT；
- 如果面向开发者发布，保留 `docs/`、`tests/` 和 `scripts/`。

压缩包不应包含：

- `.git/`；
- `output/`、`artifacts/`、`.playwright-cli/`；
- 本机浏览器 profile；
- 测试缓存和调试日志；
- 个人账号信息。

## Screenshot publishing

当前素材已经覆盖：

- 首页；
- 动态；
- 搜索；
- 普通视频播放。

当前四张截图已经作为公开仓库的固定素材集合：`home.png`、`dynamic.png`、`watch.png` 和 `search.png`。详情见 [`screenshots/README.md`](screenshots/README.md)。

## Attribution

公开仓库使用 MIT License，并在 `LICENSE` 中保留 `QuentinCrane` 版权署名。对项目、文章、论文或视频引用时，推荐使用：

```text
BiliTube — QuentinCrane
https://github.com/QuentinCrane/BiliTube
```

正式引用可以直接使用根目录的 `CITATION.cff`。
