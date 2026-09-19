# Security Policy

BiliTube 是一个会读取 Bilibili 页面并请求 Bilibili API 的浏览器扩展。安全问题可能影响用户的浏览器页面、登录态和 Bilibili 账号行为，因此请不要把敏感复现材料直接公开。

## Supported scope

优先处理以下问题：

- 扩展把数据发送到未在 README/隐私说明中声明的第三方服务；
- 未经用户操作修改 Bilibili 账号状态、历史、收藏、关注或其他内容；
- 绕过 Bilibili 登录、CSRF、权限或付费限制；
- 内容脚本、MAIN-world bridge 或 service worker 中的代码注入；
- host permission 被扩展功能之外的代码滥用；
- 设置、API 响应或页面消息导致的跨站数据泄露。

纯视觉问题、接口字段变化和普通页面兼容问题通常属于普通 Issue，但如果报告中包含账号数据，请按安全问题处理。

## Reporting

如果 GitHub 仓库启用了 Private vulnerability reporting，请优先使用 GitHub 的私密安全报告入口。

如果当前仓库没有可用的私密报告入口，请先创建一个不含敏感数据的 Issue，只写“存在潜在安全问题，请提供私密联系渠道”，不要粘贴复现 payload、Cookie、完整请求头、私信、历史记录或账号截图。

报告中应尽量提供：

1. 受影响的 commit、版本或文件。
2. 影响范围和最小复现步骤。
3. 是否需要登录、特定页面或特定浏览器。
4. 潜在影响，例如数据读取、未授权写入、账号状态改变或脚本执行。
5. 脱敏后的日志或最小化测试样本。

## Do not include

- Bilibili Cookie、`bili_jct`、token、Authorization header 或二维码；
- 个人账号 UID 与完整 API 响应的组合；
- 私信、历史记录、动态草稿或未公开内容；
- 可以直接执行的恶意 payload，除非已通过私密渠道沟通并确认安全处理方式。

## Maintainer process

维护者收到报告后会：

1. 确认是否能在当前源码和支持范围内复现。
2. 评估是否涉及账号状态、权限、隐私或任意脚本执行。
3. 在修复前限制公开细节，必要时先撤回受影响版本。
4. 添加回归测试或静态边界检查。
5. 发布修复后再公开必要的影响范围和修复版本。

BiliTube 是个人开源项目，不能保证对所有 Bilibili 页面、浏览器版本或第三方扩展组合提供即时响应。用户在安装开发版或加载未打包扩展前，应审阅源码和 Manifest 权限。
