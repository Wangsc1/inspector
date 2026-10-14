# inspector

Safari 开发者工具 + Cookie 读取，基于 [Scripting](https://apps.apple.com/app/apple-store/id6479691128)。一个仓库，两个部分：

| 部分 | 文件 | 运行位置 | 作用 |
|---|---|---|---|
| 开发者工具 | `netdebug.user.js` | Safari 扩展 | Eruda 轻量开发者工具（Elements / Console / Network / Resources / Sources / Info）、设置页中文、Cookies 页签 |

## 安装

**开发者工具（Safari 扩展）**

在 Scripting 的 Safari 扩展弹窗中选择从 URL 安装：

```
https://raw.githubusercontent.com/Wangsc1/inspector/main/netdebug.user.js
```

脚本带有 updateURL，之后可在扩展弹窗中更新。

## 使用
- 页面右下角出现 Eruda 齿轮图标，点开即是开发者工具，面板默认收起。
- Cookies 页签读取 Safari 页面的 Cookie（GM.cookie + document.cookie）；旧版 Scripting 曾漏读会话 Cookie；升级修复标签页存储问题后已实测读到登录会话，但不能承诺所有记录完整。
- 需要完整 Cookie 时，点 Cookies 页签里的「App内操作」，会跳到 CookieReader 并带入当前网址，在 App 内 WebView 登录后读取。App 内 WebView 与 Safari 的登录状态相互独立，首次需登录，后续可复用仍有效的 WebView 会话。

## 说明
- 开发者工具默认匹配所有网站，如只需调试特定站点，请修改 `@match`。
- 页面 CSP 严格时 Eruda 可能无法启动，会弹出提示。
- Cookie 等同登录凭证，请勿公开分享。
- 仓库不含任何账号、Cookie 或密钥。

## 当前版本与更新
- Safari 脚本 2.8.0：在扩展弹窗更新；保持点击齿轮展开，不自动打开。
- App 脚本 0.3.1：在 Scripting 中长按 CookieReader，选择更新。无内置更新按钮或自行覆盖源码逻辑；Safari 脚本仍单独在扩展弹窗更新。
- Cookie 合并保留不同域名/路径的同名记录；网页来源无法提供这些属性时会标明未知。
- App 的请求头复制由 WebKit 按输入网址筛选 Cookie，避免混入其他路径/站点的记录；JSON 展示是域名相关记录。

## 能力边界
这不是 Chrome F12 的完整替代品。缺少浏览器级断点/单步、完整网络抓取、堆快照和性能火焰图。Eruda 初始化前的请求/日志可能遗漏，未对 iframe 注入，严格 CSP 页面可能无法启动。
Cookie 值展示与复制可能暴露登录状态；只在可信站点调试，勿分享含明文凭证的截图或日志。App 导出的是 WebView 自己的会话，不是 Safari 当前会话，不保证跨设备登录可用。

### Safari 2.8.0
- 增加 `cf_clearance` 定向补查，合并当前网址、站点根地址与域名查询结果，并过滤域名、路径、安全协议和过期时间。
- 查询未找到与部分查询失败分别提示；不生成 Cookie，不自动发起 Cloudflare 验证，不注入服务器会话。
- 删除「手动复制框」按钮及复制失败时生成的文本框；自动复制失败仅提示。
- App 跳转按钮更名为「App内操作」，行为不变。

### Safari 2.8.1
- Cookies 页签跟随 Eruda 深浅主题，修复深色下提示不可读及白色卡片不协调的问题。

### Safari 2.9.0
- 开发者工具各页签文字允许原生选择和长按复制菜单；按钮、滑块、页签与输入控件保留交互。不修改网站正文。
- 已在 Chromium 验证选择样式及 contextmenu 未被阻止；iOS 原生长按菜单仍需真机确认。

### Safari 2.9.1
- 补充按 cf_clearance 名称及当前标签页已返回的真实 storeId 查询，仍过滤其他域名和不适用路径。
- 移除 Cookie 数量行中关于 Safari 漏读会话的旧提示。

### CookieReader 0.3.2
- 新增「用剪贴板 Cookie 验证独立会话」，支持 JSON 与 Cookie 请求头。只在临时非持久化 WebView 注入；不复用已有登录，不保存导入记录，关闭后释放。
- 手机操作：更新 CookieReader，复制待测 Cookie，点验证入口，不输入账号密码；关闭网页后反馈状态。每套 Cookie 分别验证。
- 请求头缺少域名/路径属性，按当前网址域名及根路径导入；优先使用 JSON。文字检测仅作为登录线索，不等同最终鉴权结论。

### 移除 CookieReader
- 已从仓库删除 `index.tsx` 和 `script.json`。Safari 脚本中的「App内操作」按钮仍会尝试跳转 CookieReader，未安装则不可用。
