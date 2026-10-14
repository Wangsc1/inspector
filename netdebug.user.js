// ==UserScript==
// @name         开发者工具 (Eruda)
// @namespace    openbear.netdebug
// @version      2.2.0
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
// @grant        GM.cookie
// @connect      *
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


  // ===== Cookie 桥接：GM.cookie 只能在扩展内容世界调用，结果经事件回传给页面里的 Eruda 面板 =====
  document.addEventListener('__nd_cookie_req', async function () {
    var out;
    try {
      var list = await GM.cookie.list({ url: location.href });
      out = { ok: true, cookies: list };
    } catch (e) {
      out = { ok: false, error: String(e && e.message || e), fallback: document.cookie };
    }
    document.dispatchEvent(new CustomEvent('__nd_cookie_res', { detail: JSON.stringify(out) }));
  });

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


  function cookiePlugin() {
    window.eruda.add(function (eruda) {
      var Tool = eruda.Tool;
      function Cookies() {
        Tool.call(this);
        this.name = 'cookies';
      }
      Cookies.prototype = Object.create(Tool.prototype);
      Cookies.prototype.constructor = Cookies;
      var cur = [];
      function copy(t, done) {
        var ta = document.createElement('textarea');
        ta.value = t; ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;font-size:16px';
        document.documentElement.appendChild(ta);
        var ok = false;
        try { ta.focus(); ta.select(); ta.setSelectionRange(0, t.length); ok = document.execCommand('copy'); } catch (e) {}
        ta.remove();
        if (!ok && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(t).then(function () { done(true); }, function () { done(false); });
          return;
        }
        done(ok);
      }
      Cookies.prototype.init = function ($el) {
        Tool.prototype.init.call(this, $el);
        var root = $el.get(0);
        var self = this;
        root.style.cssText = 'padding:8px;overflow:auto;font-size:13px;color:#333';
        function mk(tag, css, txt) { var d = document.createElement(tag); if (css) d.style.cssText = css; if (txt != null) d.textContent = txt; return d; }
        function btn(txt, fn) {
          var b = mk('button', 'background:#e8e8e8;color:#222;border:1px solid #bbb;border-radius:6px;padding:6px 10px;margin:2px 4px 2px 0;font-size:13px', txt);
          b.onclick = fn; return b;
        }
        var msg = mk('div', 'color:#666;margin:4px 0;word-break:break-all');
        var tools = mk('div', 'margin-bottom:6px');
        var list = mk('div');
        function flash(t) { msg.textContent = t; }
        function doCopy(t) { copy(t, function (ok) { flash(ok ? '已复制 (' + t.length + ' 字符)' : '自动复制被拦截，请在下方文本框长按全选后拷贝'); if (!ok) manual(t); }); }
        function manual(t) {
          var ta = mk('textarea', 'width:100%;height:120px;font-size:16px;margin:6px 0;box-sizing:border-box');
          ta.value = t; list.insertBefore(ta, list.firstChild);
          setTimeout(function () { ta.focus(); ta.select(); try { ta.setSelectionRange(0, t.length); } catch (e) {} }, 50);
        }
        function draw(res) {
          list.innerHTML = '';
          var cs;
          if (res.ok) { cs = res.cookies || []; flash('共 ' + cs.length + ' 条（含 HttpOnly，来自 GM.cookie）'); }
          else {
            flash('GM.cookie 失败：' + res.error + '；已降级为 document.cookie（不含 HttpOnly）');
            cs = res.fallback ? res.fallback.split(/;\s*/).map(function (x) { var i = x.indexOf('='); return { name: x.slice(0, i), value: x.slice(i + 1) }; }) : [];
          }
          cur = cs;
          if (!cs.length) { list.appendChild(mk('div', 'color:#999;padding:12px 0', '(无 Cookie)')); return; }
          cs.forEach(function (c) {
            var box = mk('div', 'border:1px solid #ccc;border-radius:6px;padding:8px;margin:6px 0;background:#fff');
            box.appendChild(mk('div', 'font-weight:600;word-break:break-all', c.name));
            box.appendChild(mk('div', 'font-family:Menlo,monospace;word-break:break-all;margin:4px 0;color:#0a58ca', String(c.value)));
            var attrs = [];
            Object.keys(c).forEach(function (k) {
              if (k === 'name' || k === 'value') return;
              var v = c[k];
              if (v === true) attrs.push(k); else if (v === false || v == null || v === '') return; else attrs.push(k + '=' + v);
            });
            if (attrs.length) box.appendChild(mk('div', 'color:#777;font-size:12px;word-break:break-all', attrs.join(' | ')));
            box.appendChild(btn('复制 name=value', function () { doCopy(c.name + '=' + c.value); }));
            box.appendChild(btn('仅复制值', function () { doCopy(String(c.value)); }));
            list.appendChild(box);
          });
        }
        function load() {
          flash('读取中…');
          var done = false;
          var h = function (ev) { done = true; document.removeEventListener('__nd_cookie_res', h); try { draw(JSON.parse(ev.detail)); } catch (e) { flash('解析失败：' + e); } };
          document.addEventListener('__nd_cookie_res', h);
          document.dispatchEvent(new CustomEvent('__nd_cookie_req'));
          setTimeout(function () { if (!done) { document.removeEventListener('__nd_cookie_res', h); flash('无响应：内容世界未返回（脚本未授权 GM.cookie 或未运行）'); } }, 3000);
        }
        tools.appendChild(btn('刷新', load));
        tools.appendChild(btn('复制全部(请求头)', function () { doCopy(cur.map(function (c) { return c.name + '=' + c.value; }).join('; ')); }));
        tools.appendChild(btn('复制JSON', function () { doCopy(JSON.stringify(cur, null, 2)); }));
        tools.appendChild(btn('手动复制框', function () { manual(cur.map(function (c) { return c.name + '=' + c.value; }).join('; ')); }));
        root.appendChild(tools); root.appendChild(msg); root.appendChild(list);
        this._load = load;
      };
      Cookies.prototype.show = function () { Tool.prototype.show.call(this); if (this._load) this._load(); return this; };
      Cookies.prototype.hide = function () { Tool.prototype.hide.call(this); return this; };
      Cookies.prototype.destroy = function () { Tool.prototype.destroy.call(this); };
      return new Cookies();
    });
  }

  var inited = false;
  function initEruda() {
    if (inited) return;
    if (!document.body) return;
    inited = true;
    inPage('try{window.eruda.init({autoScale:true});(' + cookiePlugin.toString() + ')();}catch(e){document.documentElement.setAttribute("data-nd-err",String(e));}');
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
