// ==UserScript==
// @name         开发者工具 (Eruda)
// @namespace    openbear.netdebug
// @version      2.1.1
// @description  在 Safari 页面中启用完整开发者工具：Elements / Console / Network / Resources / Sources / Info / Snippets
// @match        *://*/*
// @run-at       document-start
// @noframes
// @homepageURL   https://github.com/Wangsc1/inspector
// @updateURL     https://raw.githubusercontent.com/Wangsc1/inspector/main/netdebug.user.js
// @downloadURL   https://raw.githubusercontent.com/Wangsc1/inspector/main/netdebug.user.js
// @resource     eruda https://cdn.jsdelivr.net/npm/eruda@3.4.3/eruda.js
// @grant        GM.getResourceText
// @grant        GM.registerMenuCommand
// ==/UserScript==

(async function () {
  'use strict';
  if (window.__ndLoaded) return;
  window.__ndLoaded = true;

  var de = document.documentElement;
  function toast(t) {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:50%;top:60px;transform:translateX(-50%);background:#000c;color:#fff;padding:8px 14px;border-radius:8px;z-index:2147483647;font:13px -apple-system;max-width:90vw;word-break:break-all';
    d.textContent = t;
    (document.body || de).appendChild(d);
    setTimeout(function () { d.remove(); }, 3500);
  }

  // 在页面世界执行代码（Eruda 需要钩住页面自己的 fetch/XHR/console）
  function inPage(code) {
    var s = document.createElement('script');
    s.textContent = code;
    (document.head || de).appendChild(s);
    s.remove();
  }

  var src;
  try {
    src = await GM.getResourceText('eruda');
    if (!src || src.length < 10000) throw new Error('Eruda 资源为空(' + (src ? src.length : 0) + ')，请删除脚本后重新安装以拉取 @resource');
  } catch (e) {
    window.addEventListener('DOMContentLoaded', function () { toast('开发者工具加载失败: ' + (e && e.message || e)); });
    return;
  }

  // 定义 window.eruda
  inPage(src);

  var inited = false;
  function initEruda() {
    if (inited) return;
    if (!document.body) return;
    inited = true;
    inPage('try{window.eruda.init({autoScale:true});}catch(e){document.documentElement.setAttribute("data-nd-err",String(e));}');
    var err = de.getAttribute('data-nd-err');
    if (err) { toast('开发者工具启动失败: ' + err); return; }
    if (!document.getElementById('eruda')) toast('开发者工具未能显示（页面 CSP 可能拦截了内联脚本）');
  }

  // body 一出现就初始化，尽量抓到早期请求
  if (document.body) initEruda();
  else {
    var mo = new MutationObserver(function () { if (document.body) { mo.disconnect(); initEruda(); } });
    mo.observe(de, { childList: true });
    document.addEventListener('DOMContentLoaded', function () { mo.disconnect(); initEruda(); });
  }

  // Safari 扩展菜单：直接打开完整开发者工具面板
  function show() {
    initEruda();
    inPage('try{window.eruda.show();}catch(e){}');
  }
  try {
    GM.registerMenuCommand('打开开发者工具', show);
    GM.registerMenuCommand('关闭开发者工具面板', function () { inPage('try{window.eruda.hide();}catch(e){}'); });
  } catch (e) {}
})();
