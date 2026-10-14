# inspector

Safari 开发者工具 + Cookie 读取，基于 [Scripting](https://apps.apple.com/app/apple-store/id6479691128)。一个仓库，两个部分：

| 部分 | 文件 | 运行位置 | 作用 |
|---|---|---|---|
| 开发者工具 | `netdebug.user.js` | Safari 扩展 | Eruda 轻量开发者工具（Elements / Console / Network / Resources / Sources / Info）、设置页中文、Cookies 页签 |
| CookieReader | `index.tsx` + `script.json` | Scripting App | 在 App 内 WebView 登录后，读取全部 Cookie（含 HttpOnly 与会话 Cookie） |

## 安装

**1. CookieReader（Scripting 一键导入）**

```
https://scripting.fun/import_scripts?urls=["https%3A%2F%2Fgithub.com%2FWangsc1%2Finspector"]
```

**2. 开发者工具（Safari 扩展）**

在 Scripting 的 Safari 扩展弹窗中选择从 URL 安装：

```
https://raw.githubusercontent.com/Wangsc1/inspector/main/netdebug.user.js
```

脚本带有 updateURL，之后可在扩展弹窗中更新。

## 使用
- 页面右下角出现 Eruda 齿轮图标，点开即是开发者工具，面板默认收起。
- Cookies 页签读取 Safari 页面的 Cookie（GM.cookie + document.cookie）；当前手机实测 Safari 接口漏读会话 Cookie，不能承诺列表完整。
- 需要完整 Cookie 时，点 Cookies 页签里的「在 App 读取全部 Cookie」，会跳到 CookieReader 并带入当前网址，在 App 内 WebView 登录后读取。App 内 WebView 与 Safari 的登录状态相互独立，首次需登录，后续可复用仍有效的 WebView 会话。

## 说明
- 开发者工具默认匹配所有网站，如只需调试特定站点，请修改 `@match`。
- 页面 CSP 严格时 Eruda 可能无法启动，会弹出提示。
- Cookie 等同登录凭证，请勿公开分享。
- 仓库不含任何账号、Cookie 或密钥。

## 当前版本与更新
- Safari 脚本 2.7.0：在扩展弹窗更新；保持点击齿轮展开，不自动打开。
- App 脚本 0.3.0：升级到本版后，使用「检查并更新 App 脚本」原地更新 `index.tsx`，不覆盖本地 `script.json` 来源信息。更新后关闭并重新运行；Safari 脚本仍单独在扩展弹窗更新。
- Cookie 合并保留不同域名/路径的同名记录；网页来源无法提供这些属性时会标明未知。
- App 的请求头复制由 WebKit 按输入网址筛选 Cookie，避免混入其他路径/站点的记录；JSON 展示是域名相关记录。

## 能力边界
这不是 Chrome F12 的完整替代品。缺少浏览器级断点/单步、完整网络抓取、堆快照和性能火焰图。Eruda 初始化前的请求/日志可能遗漏，未对 iframe 注入，严格 CSP 页面可能无法启动。
Cookie 值展示与复制可能暴露登录状态；只在可信站点调试，勿分享含明文凭证的截图或日志。App 导出的是 WebView 自己的会话，不是 Safari 当前会话，不保证跨设备登录可用。
