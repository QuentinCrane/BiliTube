# BiliTube 0.12.5 Release Notes Draft

这是当前 GitHub Release 可以直接参考的发布文案草稿。正式发布前，需要把“待实机验证”项目替换成真实浏览器证据，不要仅凭 Node 测试宣称生产页面完全通过。

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

临时未登录 Edge 配置验证了一次相关推荐同页切换：URL 保持同一文档，播放器仍在标题上方，视频节点持续播放。自动验证和这次公开页面探针不能替代登录态 Edge/Chrome 的全面人工验收。

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
- [ ] Release 页面明确列出尚未验证的项目。
