# BiliTube 0.12.6 Release Notes Draft

本文汇总 0.12.6 的候选发布文案、验证证据和发布待办。

## Current source

- Repository: `https://github.com/QuentinCrane/BiliTube`
- Manifest version: `0.12.6`
- Extension type: Chromium / Edge Manifest V3
- License: MIT
- Attribution: `QuentinCrane`

## Highlights

- YouTube Desktop 风格的 Bilibili Header、Sidebar、Mini Guide 和自适应内容大网格。
- 首页多列推荐、分类 Chips，以及关注更新/正在直播/番剧更新/热门内容四个可独立开关的 Shelf。
- 细致的跳转规则：首页推荐默认新标签页打开，播放页相关推荐默认当前页平滑切换；首页搜索当前页打开，播放页搜索新标签页打开（推荐打开方式支持在设置中按习惯独立调整）。
- 搜索建议、综合搜索、视频/用户/番剧/影视分类 Tab，以及排序与时长筛选。
- 普通视频页双栏布局与原生第一原则：Bilibili 原生播放器、画质、倍速、弹幕、分 P、点赞投币三连与评论回复无损保留。
- 播放器留白模糊填充：针对竖屏与特殊比例视频智能填充留白，小画布逐帧同步并在移出视野时自动暂停连续处理。
- 收藏夹内搜索视频、悬停无声预览（带进度条）、稍后再看快捷操作、动态与个人空间统一适配。
- 深浅色主题、毛玻璃与 YouTube Desktop 纯净基线、中英双语跟随浏览器。

## Changes in v0.12.6

- 普通视频播放器按画面比例产生的留白支持模糊填充，保持视频原有长宽比，可在设置中关闭；视频内容和原生控件保持原样。
- 模糊填充同步与性能优化：跟随视频帧更新（`requestVideoFrameCallback`），48px 小画布采样避免全屏高斯模糊计算开销；播放器滚出视野时通过 `IntersectionObserver` 自动暂停连续处理。
- 导航规则细化：首页推荐默认在新标签页打开，播放页相关推荐默认在当前标签页打开，两处可在设置中分别配置；首页搜索默认当前标签页，播放页搜索默认新标签页。
- 当前收藏夹支持按关键词搜索视频、清除和结果分页；搜索、刷新及切换收藏夹时隔离旧响应，保留正在输入的草稿。
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
