// ==UserScript==
// @name         开发者工具 (Eruda)
// @namespace    openbear.netdebug
// @version      2.3.0
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


  // ===== 设置页汉化：Eruda 3.4.3 没有语言选项，文案是源码字面量，加载前按精确上下文替换（替换不到则跳过，不影响功能）=====
  var ZH = [
    [',"rememberPos","Remember Entry Button Position")', ',"rememberPos","记住入口按钮位置")'],
    ['.range(n,"transparency","Transparency"', '.range(n,"transparency","透明度"'],
    ['.range(n,"displaySize","Display Size"', '.range(n,"displaySize","显示大小"'],
    ['e.button("Restore defaults and reload"', 'e.button("恢复默认设置并重新加载"'],
    ['.select(n,"theme","Theme"', '.select(n,"theme","主题"'],
    ['.switch(n,"asyncRender","Asynchronous Rendering")', '.switch(n,"asyncRender","异步渲染")'],
    ['.switch(n,"jsExecution","Enable JavaScript Execution")', '.switch(n,"jsExecution","允许执行 JavaScript")'],
    ['.switch(n,"catchGlobalErr","Catch Global Errors")', '.switch(n,"catchGlobalErr","捕获全局错误")'],
    ['.switch(n,"overrideConsole","Override Console")', '.switch(n,"overrideConsole","接管 Console")'],
    ['.switch(n,"displayIfErr","Auto Display If Error Occurs")', '.switch(n,"displayIfErr","出错时自动显示面板")'],
    ['.switch(n,"displayExtraInfo","Display Extra Information")', '.switch(n,"displayExtraInfo","显示额外信息")'],
    ['.switch(n,"displayUnenumerable","Display Unenumerable Properties")', '.switch(n,"displayUnenumerable","显示不可枚举属性")'],
    ['.switch(n,"displayGetterVal","Access Getter Value")', '.switch(n,"displayGetterVal","读取 Getter 的值")'],
    ['.switch(n,"lazyEvaluation","Lazy Evaluation")', '.switch(n,"lazyEvaluation","延迟求值")'],
    ['.select(n,"maxLogNum","Max Log Number"', '.select(n,"maxLogNum","最大日志条数"'],
    ['.text("Elements").switch(t,"overrideEventTarget","Catch Event Listeners")', '.text("Elements").switch(t,"overrideEventTarget","捕获事件监听器")'],
    ['.switch(t,"observeElement","Auto Refresh Elements")', '.switch(t,"observeElement","自动刷新元素")'],
    ['.switch(t,"hideErudaSetting","Hide Eruda Setting")', '.switch(t,"hideErudaSetting","隐藏 Eruda 自身设置")'],
    ['.switch(t,"showLineNum","Show Line Numbers")', '.switch(t,"showLineNum","显示行号")']
  ];
  function zhSrc(code) {
    var miss = [];
    ZH.forEach(function (p) {
      if (code.indexOf(p[0]) >= 0) code = code.split(p[0]).join(p[1]); else miss.push(p[0]);
    });
    // 主题默认值 "System preference" 既是选项文案也是配置值，不动它，下面单独在运行时汉化显示
    return { code: code, miss: miss };
  }

  var src;
  try {
    src = await GM.getResourceText('eruda');
    if (!src || src.length < 10000) throw new Error('Eruda 资源为空(' + (src ? src.length : 0) + ')，请删除脚本后重新安装以拉取 @resource');
  } catch (e) {
    window.addEventListener('DOMContentLoaded', function () { toast('开发者工具加载失败: ' + (e && e.message || e)); });
    return;
  }

  // 汉化后再定义 window.eruda
  var zr = zhSrc(src);
  src = zr.code;
  de.setAttribute('data-nd-zh-miss', String(zr.miss.length));
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


  // 设置页里分区标题 / 下拉选项是“配置值”，不能改源码字符串；渲染后只改显示文字（textContent），不碰 value
  var ZH_TEXT = { 'Console': '控制台', 'Elements': '元素', 'Resources': '资源', 'Sources': '源码',
    'System preference': '跟随系统', 'Light': '浅色', 'Dark': '深色', 'infinite': '不限制' };
  function zhRuntime() {
    var host = document.getElementById('eruda');
    var root = host && (host.shadowRoot || host);
    if (!root) return;
    // 设置页由 luna-setting 组件渲染；只在其内部、且只改文字与映射表完全相等的叶子节点，不碰日志和页面内容
    root.querySelectorAll('.luna-setting').forEach(function (scope) {
      scope.querySelectorAll('*').forEach(function (n) {
        if (n.children.length !== 0) return;
        var t = (n.textContent || '').trim();
        if (ZH_TEXT.hasOwnProperty(t)) n.textContent = ZH_TEXT[t];
      });
    });
  }
  function watchZh() {
    var host = document.getElementById('eruda');
    var root = host && (host.shadowRoot || host);
    if (!root) return;
    var busy = false;
    new MutationObserver(function () {
      if (busy) return; busy = true;
      setTimeout(function () { busy = false; try { zhRuntime(); } catch (e) {} }, 60);
    }).observe(root, { childList: true, subtree: true });
    zhRuntime();
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
    else watchZh();
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
