# inspector

Safari 开发者工具 + Cookie 读取，基于 [Scripting](https://apps.apple.com/app/apple-store/id6479691128)。一个仓库，两个部分：

| 部分 | 文件 | 运行位置 | 作用 |
|---|---|---|---|
| 开发者工具 | `netdebug.user.js` | Safari 扩展 | Eruda 完整开发者工具（Elements / Console / Network / Resources / Sources / Info）、设置页中文、Cookies 页签 |
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
- Cookies 页签读取 Safari 页面的 Cookie（GM.cookie + document.cookie）；会话类 Cookie 这里读不到。
- 需要完整 Cookie 时，点 Cookies 页签里的「在 App 读取全部 Cookie」，会跳到 CookieReader 并带入当前网址，在 App 内 WebView 登录后读取。App 内 WebView 与 Safari 的登录状态相互独立，需重新登录一次。

## 说明
- 开发者工具默认匹配所有网站，如只需调试特定站点，请修改 `@match`。
- 页面 CSP 严格时 Eruda 可能无法启动，会弹出提示。
- Cookie 等同登录凭证，请勿公开分享。
- 仓库不含任何账号、Cookie 或密钥。
