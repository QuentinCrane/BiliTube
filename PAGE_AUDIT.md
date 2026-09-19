# BiliTube 0.12.4 页面验收矩阵

> 自动回归用于约束代码结构、路由、样式与接口行为；**它不能替代登录态 Edge + 当前 Bilibili 生产页面的真实点击验收**。下表中“自动”表示已有回归/验证覆盖，“实机”在用户真实环境验证前均视为待确认。

| 页面 / 能力 | 0.12.4 目标行为 | 自动 | 实机 |
| --- | --- | :---: | :---: |
| 全局 Header | 56px；菜单、BiliTube 标识、居中搜索、动态、通知、主题、头像 | ✓ | 待验 |
| 展开 Sidebar | 240px；YouTube 分组节奏、细分割线、滚动时临时 4px thumb | ✓ | 待验 |
| Mini Guide | 72px；核心入口图标 + 短标签；隐藏次级订阅/探索组 | ✓ | 待验 |
| Overlay Drawer | Watch / Adapt 页面左上角菜单打开同一套 240px 抽屉；关闭遮罩不参与命中 | ✓ | 待验 |
| 首页 | YouTube 推荐 Grid + Bilibili 关注 / 直播 / 番剧 / 热门 Shelf；主题 Chips | ✓ | 待验 |
| 视频卡 | 16:9、12px 圆角、两行标题、创作者/播放信息层级统一 | ✓ | 待验 |
| Hover Preview | 封面内部预览；覆盖层点击穿透；仅 seek rail 接收拖动 | ✓ | 待验 |
| Hover 稍后再看 | 右上角时钟按钮；只拦自身点击；B站 add/del；同视频状态同步 | ✓ | 待验 |
| 搜索建议 | Bilibili 官方 suggest；约 180ms debounce；鼠标 + ↑/↓ + Enter + Esc | ✓ | 待验 |
| 搜索“全部” | 官方 WBI 综合搜索；最多 1 个最相关 UP 卡 + 大量视频 | ✓ | 待验 |
| 搜索“用户” | 完整频道列表；频道卡与关注能力 | ✓ | 待验 |
| Space / Channel | Banner、头像、名称/简介、频道 Tab、投稿 Grid 按 YouTube Channel 构图 | ✓ | 待验 |
| History | native-first Adapt；B站原生历史数据/分页/管理能力保留，外层适配 YouTube History 风 | ✓ | 待验 |
| Watch Later | Playlist 式概览 + 有序列表；观看进度与连续播放入口 | ✓ | 待验 |
| Favorites | Selected-folder 概览 + 播放列表/媒体库结构 | ✓ | 待验 |
| Dynamic / Subscriptions | 订阅式最新内容流 + 统一卡片 | ✓ | 待验 |
| Settings | 56px 顶栏 + 240px 左导航；外观/导航/首页/播放/搜索/内容分组；设置均接运行时 | ✓ | 待验 |
| 普通 Watch 布局 | 保留原生左右栏盒模型；顶层两栏 Grid + 左栏 Flex/Order，禁止关键容器 `display: contents`；主栏 + 约 402px 相关推荐栏；16px 栏间距，大屏约 36px 外侧安全留白 | ✓ | 待验 |
| Watch 初载稳定性 | `/video/` 在 document_start 进入 Watch preflight，并以最终双栏几何首帧呈现；核心 DOM 就绪后原子切换 `bt-watch-ready`，observer 仅观察 Watch 主布局/播放器区域 | ✓ | 待验 |
| 主题切换动画 | 深浅色切换优先 View Transition，回退约 200ms CSS 过渡；主题按钮轻微旋转/缩放，并尊重 `prefers-reduced-motion` | ✓ | 待验 |
| Watch 播放器 | 原节点、原父节点；正常模式视觉 16:9 / 12px 圆角，BPX 控制条尺度校准；不替换控件 | ✓ | 待验 |
| Watch UP / 关注 | BiliTube 在左栏镜像简单作者行（头像/名称/空间链接/关注）；标题信息容器强制内容高度，作者行与标题保持紧凑；右栏原生 UP 区隐藏避免重复 | ✓ | 待验 |
| Watch toolbar | 点赞/投币/收藏/分享/三连由 Bilibili 原生 toolbar 直接处理，无 synthetic event / event bridge | ✓ | 待验 |
| Watch 评论 | 原生评论根始终留在 Bilibili 原位置；不移动、不重建、不改 Shadow DOM 内部 | ✓ | 待验 |
| Watch 相关推荐 | Bilibili 原生推荐业务节点和原生链接；所有右栏卡片恢复两行标题、UP 名与播放/时间 metadata，懒加载内容继承同一套布局 | ✓ | 待验 |
| 宽屏 | 观察 B站 `data-screen=wide` 等原生状态，释放普通双栏约束 | ✓ | 待验 |
| 网页全屏 | BiliTube 外围 chrome/布局让位，由 B站播放器几何接管 | ✓ | 待验 |
| 浏览器真全屏 | 监听 Fullscreen API 状态并释放外围布局 | ✓ | 待验 |
| Adapt 页面 | 消息 / 直播 / 番剧 / 课程 / 创作中心 / 账号等保留原业务 DOM，仅统一 Header / Drawer / Theme / 外层视觉 | ✓ | 待验 |
| 普通链接 | 首页、搜索、历史、收藏、侧栏等使用真实 `<a href>`；不依赖 MAIN-world 跳转桥 | ✓ | 待验 |

## Native-first Watch 禁止项

- 不移动、克隆或替换播放器。
- 不移动、克隆或替换原生 toolbar、简介、评论、相关推荐模块；作者信息只允许创建简单镜像行，不复制复杂 Bilibili 互动。
- 不创建 BiliTube 自制的 Watch 点赞 / 投币 / 收藏 / 分享按钮来代理原生交互。
- 不对原生 Watch 互动合成 `click` / `pointer` / `mouse` 事件。
- 不允许 `.left-container`、`.right-container`、`.right-container-inner` 在普通 Watch 中使用 `display: contents`。
- 不对评论做 API 重渲染，也不进入原生评论 Shadow DOM 改结构。
- 不拦截普通相关推荐或其他普通链接的浏览器默认导航。

## Native History 禁止项

- `/history` 与 `/account/history` 不使用 BiliTube Replace。
- 不把自绘 History API 页面作为主路径。
- 不隐藏或替换 Bilibili 原生历史搜索、清除、管理、分页 / 无限滚动能力。
- 只允许对 History 外层结构、卡片几何、文字层级、主题和间距做视觉适配。

## Edge + Bilibili 人工验收清单

发行包安装后，需要在**登录状态的真实 Edge + 当前 Bilibili 页面**逐项确认：

1. 首页视频卡左键打开，中键 / Ctrl 或 Command + 点击在新标签打开。
2. 首页 Hover Preview 能播放、拖动进度条；右上角“稍后再看”能加入/移除且不打开视频。
3. 搜索框建议出现，键盘 ↑/↓/Enter/Esc 正常；“全部”表现为最多 1 个 UP + 大量视频，“用户”Tab 才是完整 UP 列表。
4. 普通视频页播放器播放、暂停、音量、弹幕、进度条不受 BiliTube 影响。
5. 原生点赞可以点击并更新状态。
6. 原生投币可弹出 B站投币窗口并完成操作。
7. 原生收藏可弹出 B站收藏夹窗口并完成操作。
8. 原生分享入口可正常展开 / 操作。
9. 原生关注可以点击，关注状态正常更新。
10. 评论列表能加载；评论输入、表情/图片等原生入口（账号权限允许时）、发布、回复、楼中楼均可正常工作。
11. 右侧相关推荐封面 / 标题 / UP 链接均可点击，中键打开正常；标题、UP 名和播放/时间信息完整显示，向下懒加载后仍不丢失。
12. 宽屏进入、退出后播放器尺寸正确，页面不会被普通双栏宽度压缩。
13. 网页全屏进入、退出正常，BiliTube 外围 UI 不覆盖播放器。
14. 浏览器真全屏进入、退出正常。
15. Watch 左上角菜单能打开 Sidebar；点击遮罩关闭；Sidebar 项目均可导航。
16. 消息、直播、番剧、Space 子页、创作中心等 Adapt 页面可打开同一套 Sidebar，且原页面核心业务仍能使用。
17. History 原生页面能正常加载、搜索、滚动、清除/管理记录；Watch Later / Favorites / Dynamic 能正常加载、滚动、点击与继续分页。
18. 深色 / 浅色切换时 Header、Sidebar、主体与 Adapt 外层同时切换，有短暂平滑过渡而非瞬时跳色；开启系统“减少动态效果”时不过度动画。
19. Watch 首次加载时不应先出现 B站原布局再跳成 BiliTube；标题/数据区与 UP 头像之间保持紧凑，不因原生固定高度出现大空白；顶栏“动态”可直接打开动态页。

**当前实机状态：待用户验证。** 如果人工验收失败，应以具体页面和动作作为下一轮故障输入，而不是把自动测试通过当成生产页面已成功。


## Watch mini-player regression

- Scrolling into Bilibili `data-screen="mini"` must not switch the Watch page to the wide/single-column layout.
- Recommendations remain visible in the underlying Watch grid.
- Mini player keeps Bilibili-owned geometry and is excluded from ordinary YouTube-sized BPX control overrides.
