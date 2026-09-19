# BiliTube Privacy Notes

本文说明 BiliTube 在当前源码中的数据边界。BiliTube 是一个运行在用户浏览器中的本地视觉扩展，不是 Bilibili 官方客户端，也没有 BiliTube 自己的云端账户或同步服务。

## Short version

- 不创建 BiliTube 账号。
- 不接入广告、订阅、遥测或自建统计服务。
- 设置写入浏览器 `chrome.storage.local`。
- 页面数据和播放预览请求发往 Bilibili 自己的域名。
- BiliTube 不上传照片、视频或评论到自有服务器。
- Bilibili 的账号、Cookie、接口和隐私政策仍然适用于 Bilibili 请求本身。

## Permissions

当前 `manifest.json` 声明：

| Manifest 项 | 为什么需要 |
| --- | --- |
| `storage` | 保存启用状态、主题、布局、预览和搜索等选项；监听设置变更并同步已打开页面 |
| `*://*.bilibili.com/*` / `*://bilibili.com/*` | 在 Bilibili 主站、动态、Space 等页面注入内容脚本和样式 |
| `*://api.bilibili.com/*` | 访问推荐、搜索、历史、动态、订阅、收藏夹、用户和播放器接口 |
| `*://*.hdslb.com/*` | 加载 Bilibili 返回的图片等 CDN 资源 |
| `*://*.bilivideo.com/*` | 支持 Bilibili 返回的媒体预览资源 |

扩展没有声明 `tabs`、`cookies`、`webRequest`、`scripting` 或下载权限。内容脚本的页面访问来自明确声明的 Bilibili host permission，而不是任意网站。

## Data flow

```text
Bilibili page
  ├── current URL / visible native state
  ├── page-owned login and video metadata
  └── BiliTube content runtime
          │ chrome.runtime.sendMessage
          ▼
      Manifest V3 service worker
          │ credentials: include
          ▼
      Bilibili API / Bilibili media CDN
```

`src/core/api-client.js` 只向扩展 service worker 发消息。`src/background.js` 负责 Bilibili API、短期内存缓存、WBI 签名和必要的 POST 操作。BiliTube 没有把这些数据转发到第三方 BiliTube 服务的代码路径。

需要登录态的能力，例如历史、订阅、动态、稍后再看、收藏夹、关注和某些播放器接口，会受当前 Bilibili 登录状态、Cookie 策略、CSRF token 和接口权限影响。BiliTube 不绕过登录、验证码、付费或访问控制。

## Local storage and runtime memory

设置页使用 `chrome.storage.local` 保存一个 `bilitubeCoreSettings` 对象，内容包括：

- 是否启用扩展；
- 主题和毛玻璃/YouTube 风格；
- 页面密度和动效强度；
- 侧栏、订阅和首页 Shelf 开关；
- Hover Preview 延迟和稍后再看按钮；
- 卡片辅助信息、搜索建议和广告隐藏选项。

请求缓存、当前用户、当前 feed、分页游标、稍后再看集合、预览 URL 和已完成的缩略图视觉状态都保存在当前扩展运行时的内存中。关闭页面、扩展 service worker 被回收或浏览器退出后，这些内存状态不应被视为持久数据。

图片稳定性修复中的 `imageLoadStates` 只记录当前页面生命周期内某个图片 URL 是否已经完成加载或进入终态。它不会把图片文件复制到 BiliTube 目录，也不会把浏览历史写入 BiliTube 服务器。

## What BiliTube does not collect

按当前源码，BiliTube 没有：

- BiliTube 自有用户系统；
- 远程数据库或用户画像；
- 页面浏览遥测、崩溃上报或广告统计；
- 将 Cookie、账号信息、评论内容或观看记录上传到项目维护者的服务；
- 读取无关网站的页面内容。

浏览器、Bilibili 页面本身、Bilibili API、CDN 和用户安装的其他扩展可能有各自的数据处理行为；这些不应被归因于 BiliTube 自己的服务。

## Third-party content and CDN

推荐卡、头像、封面和预览可能直接使用 Bilibili 返回的 URL。浏览器访问这些资源时，网络请求会到达相应的 Bilibili/CDN 域名。BiliTube 不保证这些 URL 长期有效，也不缓存一份项目自己的媒体副本。

如果维护者在 README 中加入截图，应去除账号头像、私密动态、Cookie、个人推荐内容和其他敏感信息。真实封面、头像和视频仍可能受版权或站点规则约束。

## Disable and restore

用户可以通过以下方式停止 BiliTube 的页面接管：

1. 在扩展设置中关闭“启用 BiliTube”。
2. 在目标 Bilibili URL 上增加 `bilitube_native=1`。
3. 在浏览器扩展管理页停用或移除扩展。

关闭或停用后，BiliTube 会移除自己的样式、Shell、observer 和页面状态；Bilibili 页面是否需要刷新才能重新建立原生布局，取决于当前 SPA 页面状态。

## Reporting a privacy concern

不要在公开 Issue 中粘贴 Cookie、完整请求头、个人 API 响应、私信、历史记录或带账号信息的截图。请按照 [`SECURITY.md`](../SECURITY.md) 的安全报告方式联系维护者，并只提供复现所需的最小脱敏材料。

本文描述的是当前仓库源码和 `manifest.json`，不构成 Bilibili 官方隐私政策，也不替代浏览器或 Bilibili 的法律文件。
