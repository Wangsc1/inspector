# inspector

Safari 网络调试用户脚本，基于 [Scripting](https://apps.apple.com/app/apple-store/id6479691128) 的 Safari Browser Scripts 运行。

## 功能
- 抓取页面 fetch / XHR / WebSocket 请求的状态码与耗时
- 记录资源加载失败、JS 报错、Promise 拒绝、console.warn/error
- 通过 GM.xmlHttpRequest 探测 URL（无 CORS 限制，含状态码、响应头、最终 URL、延迟）
- 查询出口信息、查看 Cookie 属性、导航耗时与最慢资源
- 复制日志，或经 Scripting.FileManager 保存到文件

## 安装
在 Scripting 的 Safari 扩展弹窗中选择从 URL 安装，填入：

```
https://raw.githubusercontent.com/Wangsc1/inspector/main/netdebug.user.js
```

脚本带有 updateURL，可在扩展弹窗中更新。默认匹配所有网站，如只需调试特定站点，请修改 `@match`。

## 说明
- 未在所有设备上验证；页面 CSP 严格时请求钩子可能注入失败，面板「环境」会显示钩子状态。
- 脚本不包含任何私人地址或密钥。
