# BiliTube 0.12.5 Release Notes Draft

本文汇总 0.12.5 的候选发布文案、验证证据和发布待办。

## Current source

- Repository: `https://github.com/QuentinCrane/BiliTube`
- Manifest version: `0.12.5`
- Extension type: Chromium / Edge Manifest V3
- License: MIT
- Attribution: `QuentinCrane`

## Highlights

- YouTube Desktop-inspired Bilibili Header、Sidebar、Mini Guide 和内容卡片。
- 首页推荐网格、关注/直播/番剧/热门 Shelf 和分类 Chips。
- 搜索建议、综合搜索、视频/用户/番剧/影视 Tab。
- Dynamic、Space、History、Watch Later 和 Favorites 的统一信息架构。
- Native-first Watch：Bilibili 原生播放器、toolbar、简介、评论和相关推荐继续保留。
- Hover Preview、seek rail、稍后再看快捷按钮、深浅色主题和可配置动效。

## Fixes in v0.12.5

- 播放页内点击推荐视频后，跨视频路由复用 Watch 装饰器，并跟踪 SPA 根节点替换，避免播放器失去布局标记。
- 视频页首屏预布局等待原站初始化；作者信息使用占位接续，减少播放器、标题和推荐列的布局跳动。
- 首页、搜索、动态、收藏夹、稍后再看和频道页面增加刷新与失败重试，并保护现有内容免受旧响应覆盖。
- 补齐搜索筛选、空状态和分页行为；优化深浅主题切换、窄窗口抽屉和卡片布局。

## Validation

```text
node --test tests/*.test.js       249 passed
node scripts/verify.mjs           passed (27 manifest resources, 22 JavaScript files)
git diff --check                  passed
```

浏览器定向验证：临时未登录 Edge 配置完成相关推荐同页切换，URL 保持同一文档，播放器留在标题上方，视频节点持续播放。完整登录态人工验收待执行，验收范围见 [`PAGE_AUDIT.md`](../PAGE_AUDIT.md)。

## Known limitations

- Bilibili DOM、WBI 参数、接口字段和推荐内容会变化。
- 登录态功能受 Bilibili 当前账号和接口权限影响。
- 截图中的推荐标题、头像、播放量和视频内容不是稳定 API 样本。
- Native-first Watch 只改变外层布局与视觉，不替换 Bilibili 内部互动组件。

## Release checklist

- [ ] `manifest.json` 版本号与 Release 标题一致。
- [ ] `node --test tests/*.test.js` 通过。
- [ ] `node scripts/verify.mjs` 通过。
- [ ] README、LICENSE、CITATION.cff、隐私和构建文档已同步。
- [ ] `docs/screenshots/` 中没有敏感账号信息。
- [ ] 扩展在全新浏览器 profile 中可以加载。
- [ ] 首页、搜索、动态、Watch、Watch Later 和 Favorites 已完成人工检查。
- [ ] 发布压缩包不包含 `.git/`、`output/`、`artifacts/`、浏览器 profile 或个人配置。
- [ ] Release 页面列出登录态人工验收状态和其余待验证项目。
