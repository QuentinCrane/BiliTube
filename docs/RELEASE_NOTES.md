# BiliTube 0.12.6 Release Notes Draft

本文汇总 0.12.6 的候选发布文案、验证证据和发布待办。

## Current source

- Repository: `https://github.com/QuentinCrane/BiliTube`
- Manifest version: `0.12.6`
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

## Changes in v0.12.6

- 普通视频播放器按画面比例产生的留白支持模糊填充，可在设置中关闭；视频内容和原生控件保持原样。
- 当前收藏夹支持按关键词搜索、清除和结果分页；搜索、刷新及切换收藏夹时隔离旧响应。
- 播放页的原生点赞栏和简介在原站更新类名后继续显示在评论之前；同页切换视频后“稍后再看”使用当前视频身份，并支持同站点登录凭据回退。
- 列表更新复用原卡片与媒体节点；分页动画只处理新增卡片，长列表重排跳过已知离屏卡片，Watch 按批处理原生区域更新。
- YouTube Desktop 基线使用 Roboto 拉丁字体，完善英文界面的文案与数量格式；毛玻璃外观可在设置中开启。

## Validation

```text
node --test tests/*.test.js       315 passed
node scripts/verify.mjs           passed (29 manifest resources, 23 JavaScript files)
git diff --check                  passed
```

浏览器定向验证覆盖首页进入播放页、公开竖屏视频的模糊填充及设置切换、相关推荐同页切换和公开收藏夹接口检索；隔离夹具覆盖收藏夹搜索、稍后再看、播放器布局和刷新。完整登录态人工验收待执行，验收范围见 [`PAGE_AUDIT.md`](../PAGE_AUDIT.md)。

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
