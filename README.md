# inspector

在 Safari 中使用的完整开发者工具用户脚本（基于 [Eruda](https://github.com/liriliri/eruda)），在 [Scripting](https://apps.apple.com/app/apple-store/id6479691128) 的 Safari Browser Scripts 中运行。

提供 Elements / Console / Network / Resources / Sources / Info / Snippets 面板。

## 安装
在 Scripting 的 Safari 扩展弹窗中选择从 URL 安装：

```
https://raw.githubusercontent.com/Wangsc1/inspector/main/netdebug.user.js
```

## 使用
- 页面加载后右下角出现 Eruda 齿轮图标，点它打开面板。
- 也可在 Safari 扩展弹窗菜单中点“打开开发者工具”直接展开面板。
- 默认匹配所有网站，如只需调试特定站点，请修改 `@match`。

## 说明
- 脚本在 body 出现后立即初始化，Network 面板从此刻开始记录。
- 页面 CSP 严格禁止内联脚本时可能无法启动，会弹出提示。
- 脚本不包含任何私人地址或密钥。
