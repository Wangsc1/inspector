// ==UserScript==
// @name         开发者工具 (Eruda)
// @namespace    openbear.netdebug
// @version      2.6.0
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
// @grant        GM.xmlHttpRequest
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
    var out = { ok: false, cookies: [], gm: 0, extra: 0, error: '' };
    var gm = [];
    try { gm = (await GM.cookie.list({ url: location.href })) || []; out.ok = true; }
    catch (e) { out.error = String(e && e.message || e); }
    out.gm = gm.length;
    // GM.cookie 在 Safari 上可能漏掉部分 Cookie（实测漏过 DataWave_token），用 document.cookie 补全，按名称去重
    var names = {};
    gm.forEach(function (c) { names[c.name] = true; });
    var extra = [];
    (document.cookie ? document.cookie.split(/;\s*/) : []).forEach(function (x) {
      var i = x.indexOf('='); if (i < 0) return;
      var n = x.slice(0, i);
      if (names[n]) return;
      names[n] = true;
      extra.push({ name: n, value: x.slice(i + 1), source: 'document.cookie（GM.cookie 未返回）' });
    });
    out.extra = extra.length;
    out.cookies = gm.concat(extra);
    document.dispatchEvent(new CustomEvent('__nd_cookie_res', { detail: JSON.stringify(out) }));
  });

  // ===== Cookie 诊断：用多种参数调用 GM.cookie.list，看哪种能读到会话 Cookie（文档只写了 url/name，其余参数是否支持需实测）=====
  document.addEventListener('__nd_cookie_diag_req', async function () {
    var host = location.hostname, parts = host.split('.');
    var root = parts.length > 2 ? parts.slice(-2).join('.') : host;
    var tests = [
      ['url=当前页面', { url: location.href }],
      ['url=站点根 /', { url: location.origin + '/' }],
      ['url=https://域名', { url: 'https://' + host }],
      ['domain=' + host, { domain: host }],
      ['domain=.' + root, { domain: '.' + root }],
      ['url+session:true', { url: location.href, session: true }],
      ['url+session:false', { url: location.href, session: false }],
      ['url+storeId=persistent-1', { url: location.href, storeId: 'persistent-1' }],
      ['url+storeId=session-1', { url: location.href, storeId: 'session-1' }],
      ['url+storeId=default', { url: location.href, storeId: 'default' }],
      ['无参数', {}]
    ];
    var rows = [], all = {};
    for (var i = 0; i < tests.length; i++) {
      var t = tests[i], r = { label: t[0], arg: JSON.stringify(t[1]) };
      try {
        var list = await GM.cookie.list(t[1]);
        r.ok = true; r.n = (list || []).length;
        r.names = (list || []).map(function (c) { return c.name + (c.httpOnly ? '[H]' : '') + (c.session || c.expirationDate == null ? '[会话]' : ''); });
        (list || []).forEach(function (c) { all[c.name] = true; });
      } catch (e) { r.ok = false; r.err = String(e && e.message || e); }
      rows.push(r);
    }
    var docNames = (document.cookie ? document.cookie.split(/;\s*/) : []).map(function (x) { return x.split('=')[0]; });
    document.dispatchEvent(new CustomEvent('__nd_cookie_diag_res', { detail: JSON.stringify({
      rows: rows, union: Object.keys(all), docNames: docNames, host: host
    }) }));
  });

  // ===== 深度诊断：除 GM.cookie 外，还有哪些路能碰到会话 Cookie（报告里不含任何 Cookie 值）=====
  document.addEventListener('__nd_cookie_deep_req', async function () {
    var L = [];
    function add(x) { L.push(x); }
    function keys(o) { try { return Object.keys(o).join(', ') || '(空)'; } catch (e) { return '(读取失败)'; } }
    function setCookieNames(h) {
      var out = [];
      String(h || '').split(/\r?\n/).forEach(function (ln) {
        var m = /^set-cookie:\s*([^=;\s]+)=[^;]*(.*)$/i.exec(ln);
        if (m) out.push(m[1] + ' ' + (m[2] || '').replace(/^;\s*/, '').replace(/;\s*/g, ' | '));
      });
      return out;
    }
    add('【1】运行环境');
    add('GM 成员: ' + keys(GM));
    add('GM.cookie 成员: ' + keys(GM.cookie));
    try { add('脚本管理器: ' + (GM.info && GM.info.scriptHandler) + ' ' + (GM.info && GM.info.version)); } catch (e) {}
    add('typeof browser=' + typeof browser + ' | typeof chrome=' + typeof chrome);
    try { if (typeof browser !== 'undefined') add('browser 成员: ' + keys(browser)); } catch (e) {}
    try { if (typeof browser !== 'undefined' && browser.runtime) add('browser.runtime 成员: ' + keys(browser.runtime)); } catch (e) {}
    var api = (typeof browser !== 'undefined' && browser) || (typeof chrome !== 'undefined' && chrome) || null;
    if (api && api.cookies) {
      add('browser.cookies 成员: ' + keys(api.cookies));
      try {
        if (api.cookies.getAllCookieStores) {
          var st = await api.cookies.getAllCookieStores();
          add('cookie stores: ' + JSON.stringify((st || []).map(function (x) { return x.id; })));
        }
      } catch (e) { add('getAllCookieStores 报错: ' + e); }
    } else add('browser.cookies 不可用（内容脚本拿不到）');

    add('【2】GM.cookie.list 附加参数');
    var extra = [
      ['partitionKey:{}', { url: location.href, partitionKey: {} }],
      ['firstPartyDomain:""', { url: location.href, firstPartyDomain: '' }],
      ['secure:true', { url: location.href, secure: true }],
      ['无 url 仅 domain+path', { domain: location.hostname, path: '/' }]
    ];
    for (var i = 0; i < extra.length; i++) {
      try {
        var r = await GM.cookie.list(extra[i][1]);
        add(extra[i][0] + ' → ' + (r || []).length + ' 条: ' + (r || []).map(function (c) { return c.name; }).join(', '));
      } catch (e) { add(extra[i][0] + ' → 报错: ' + (e && e.message || e)); }
    }

    add('【3】请求是否带登录会话（三方对比，看能否确认会话 Cookie 存在且被发送）');
    function title(t) { var m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(t || ''); return m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 60) : '(无title)'; }
    function nreq(anon) {
      return new Promise(function (res) {
        var done = false;
        function fin(o) { if (!done) { done = true; res(o); } }
        try {
          GM.xmlHttpRequest({ method: 'GET', url: location.href, anonymous: anon, timeout: 15000, responseType: 'text',
            onload: function (r) { fin({ ok: true, r: r }); },
            onerror: function (r) { fin({ ok: false, err: '请求失败' }); },
            ontimeout: function () { fin({ ok: false, err: '超时' }); } });
        } catch (e) { fin({ ok: false, err: String(e && e.message || e) }); }
      });
    }
    try {
      var f = await fetch(location.href, { credentials: 'include' });
      var ft = await f.text();
      add('页面 fetch(include) → ' + f.status + ' | 最终URL ' + f.url + ' | 长度 ' + ft.length + ' | ' + title(ft));
    } catch (e) { add('页面 fetch 报错: ' + e); }
    var A = await nreq(false), B = await nreq(true);
    [['GM请求(默认)', A], ['GM请求(anonymous:true)', B]].forEach(function (x) {
      if (!x[1].ok) { add(x[0] + ' → ' + x[1].err); return; }
      var r = x[1].r, t = r.responseText || '';
      add(x[0] + ' → ' + r.status + ' | 最终URL ' + (r.finalUrl || r.responseURL || '?') + ' | 长度 ' + t.length + ' | ' + title(t));
      var sc = setCookieNames(r.responseHeaders);
      add('   响应头 Set-Cookie: ' + (sc.length ? sc.join(' ;; ') : '(无，或被运行时隐藏)'));
    });
    add('判读：若“页面fetch”和“GM默认”一致、“anonymous”不同(跳转登录页)，说明原生请求会带上你的登录会话。');
    document.dispatchEvent(new CustomEvent('__nd_cookie_deep_res', { detail: JSON.stringify({ lines: L }) }));
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
          var cs = res.cookies || [];
          if (res.ok) flash('共 ' + cs.length + ' 条：GM.cookie ' + res.gm + ' 条' + (res.extra ? ' + document.cookie 补充 ' + res.extra + ' 条' : '') + '（GM.cookie 能读 HttpOnly）');
          else flash('GM.cookie 失败：' + res.error + '；仅显示 document.cookie（不含 HttpOnly）共 ' + cs.length + ' 条');
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
        tools.appendChild(btn('诊断', function () {
          flash('诊断中（约数秒）…');
          var done = false;
          var h = function (ev) {
            done = true; document.removeEventListener('__nd_cookie_diag_res', h);
            var d; try { d = JSON.parse(ev.detail); } catch (e) { flash('解析失败：' + e); return; }
            list.innerHTML = '';
            flash('诊断完成。每行：调用参数 → 返回条数与名称。[H]=HttpOnly，[会话]=无过期时间');
            var report = [];
            d.rows.forEach(function (r) {
              var line = r.ok ? (r.label + ' → ' + r.n + ' 条' + (r.n ? '：' + r.names.join(', ') : '')) : (r.label + ' → 报错：' + r.err);
              report.push(line);
              var box = mk('div', 'border:1px solid #ccc;border-radius:6px;padding:6px 8px;margin:4px 0;background:#fff;word-break:break-all;font-size:12px;color:' + (r.ok ? '#222' : '#c00'));
              box.textContent = line;
              list.appendChild(box);
            });
            var sum = '合并所有调用得到 ' + d.union.length + ' 个名称：' + d.union.join(', ') + '\ndocument.cookie 可见 ' + d.docNames.length + ' 个：' + d.docNames.join(', ');
            report.push(sum);
            list.appendChild(mk('div', 'padding:8px 0;color:#333;font-size:12px;white-space:pre-wrap;word-break:break-all', sum));
            list.appendChild(btn('复制诊断结果（不含 Cookie 值）', function () { doCopy(report.join('\n')); }));
          };
          document.addEventListener('__nd_cookie_diag_res', h);
          document.dispatchEvent(new CustomEvent('__nd_cookie_diag_req'));
          setTimeout(function () { if (!done) { document.removeEventListener('__nd_cookie_diag_res', h); flash('诊断无响应'); } }, 15000);
        }));
        tools.appendChild(btn('深度诊断', function () {
          flash('深度诊断中（含网络请求，最长约 30 秒）…');
          var done = false;
          var h = function (ev) {
            done = true; document.removeEventListener('__nd_cookie_deep_res', h);
            var d; try { d = JSON.parse(ev.detail); } catch (e) { flash('解析失败：' + e); return; }
            list.innerHTML = '';
            flash('深度诊断完成（不含 Cookie 值）');
            var pre = mk('div', 'font-size:12px;white-space:pre-wrap;word-break:break-all;color:#222;background:#fff;border:1px solid #ccc;border-radius:6px;padding:8px');
            pre.textContent = d.lines.join('\n');
            list.appendChild(pre);
            list.appendChild(btn('复制深度诊断结果', function () { doCopy(d.lines.join('\n')); }));
          };
          document.addEventListener('__nd_cookie_deep_res', h);
          document.dispatchEvent(new CustomEvent('__nd_cookie_deep_req'));
          setTimeout(function () { if (!done) { document.removeEventListener('__nd_cookie_deep_res', h); flash('深度诊断无响应'); } }, 40000); 
        }));
        tools.appendChild(btn('在 App 读取全部 Cookie', function () {
          // 会话类/HttpOnly Cookie 在 Safari 脚本里读不到；跳到 Scripting 的 Cookie Reader，在 App 内 WebView 登录后读取
          var u = location.href;
          var link = 'scripting://run/' + 'CookieReader' + '?url=' + encodeURIComponent(u);
          flash('正在跳转到 Scripting 的「CookieReader」（需先安装该脚本，脚本名必须是 CookieReader）。若没反应，点下方链接。');
          var a = mk('a', 'display:block;margin:8px 0;color:#0a58ca;word-break:break-all;font-size:12px', link);
          a.href = link;
          list.innerHTML = '';
          list.appendChild(a);
          list.appendChild(mk('div', 'color:#666;font-size:12px;margin-top:6px', '提示：App 里的 WebView 与 Safari 的登录状态相互独立，需要在 WebView 里重新登录一次。'));
          try { location.href = link; } catch (e) {}
        }));
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
