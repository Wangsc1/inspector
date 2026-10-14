// ==UserScript==
// @name         网络调试面板
// @namespace    openbear.netdebug
// @version      1.0.2
// @description  Safari 网络调试：抓取 fetch/XHR/WebSocket/资源错误，GM 无跨域探测、出口信息、Cookie 查看、日志复制与保存
// @match        *://*/*
// @run-at       document-start
// @noframes
// @homepageURL   https://github.com/Wangsc1/inspector
// @updateURL     https://raw.githubusercontent.com/Wangsc1/inspector/main/netdebug.user.js
// @downloadURL   https://raw.githubusercontent.com/Wangsc1/inspector/main/netdebug.user.js
// @grant        GM.registerMenuCommand
// @grant        GM.xmlHttpRequest
// @grant        GM.setClipboard
// @grant        GM.cookie
// @grant        GM.addStyle
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        Scripting.FileManager
// @connect      *
// ==/UserScript==

(function () {
  'use strict';
  if (window.__ndLoaded) return;
  window.__ndLoaded = true;

  // ========== 页面世界钩子（通过 <script> 注入，才能拦截页面自己的请求）==========
  function pageHook() {
    if (window.__ndHooked) return;
    window.__ndHooked = true;
    var seq = 0;
    function emit(o) {
      try { document.dispatchEvent(new CustomEvent('__nd_evt', { detail: JSON.stringify(o) })); } catch (e) {}
    }
    function add(type, title, detail, status) {
      var id = ++seq;
      emit({ k: 'add', id: 'p' + id, type: type, title: title, detail: detail || '', status: status || '' });
      return 'p' + id;
    }
    function upd(id, status, detail) { emit({ k: 'upd', id: id, status: status, detail: detail }); }
    function str(a) { try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch (e) { return String(a); } }
    function cut(s, n) { s = String(s); return s.length > n ? s.slice(0, n) + '…' : s; }

    var _fetch = window.fetch;
    if (_fetch) window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || String(input);
      var method = (init && init.method) || (input && input.method) || 'GET';
      var s = performance.now(), id = add('fetch', method + ' ' + url, '', '…');
      return _fetch.apply(this, arguments).then(function (r) {
        upd(id, r.status, Math.round(performance.now() - s) + 'ms | ' + (r.headers.get('content-type') || '') +
          ' | len=' + (r.headers.get('content-length') || '?') + ' | type=' + r.type + (r.redirected ? ' | →' + r.url : ''));
        return r;
      }, function (err) {
        upd(id, 'ERR', Math.round(performance.now() - s) + 'ms | ' + err);
        throw err;
      });
    };

    var XO = XMLHttpRequest.prototype.open, XS = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) { this.__nd = { m: m, u: u }; return XO.apply(this, arguments); };
    XMLHttpRequest.prototype.send = function () {
      var x = this, i = x.__nd || {}, s = performance.now(), id = add('xhr', (i.m || '') + ' ' + (i.u || ''), '', '…');
      x.addEventListener('loadend', function () {
        upd(id, x.status || 'ERR', Math.round(performance.now() - s) + 'ms | ' + (x.getResponseHeader('content-type') || '') +
          (x.status === 0 ? ' | 失败/跨域/取消' : ''));
      });
      return XS.apply(this, arguments);
    };

    var WS = window.WebSocket;
    if (WS) {
      var NW = function (url, p) {
        var ws = p ? new WS(url, p) : new WS(url);
        var id = add('ws', 'WS ' + url, '', '连接中');
        ws.addEventListener('open', function () { upd(id, 'OPEN'); });
        ws.addEventListener('close', function (ev) { upd(id, 'CLOSE', 'code=' + ev.code + ' reason=' + ev.reason); });
        ws.addEventListener('error', function () { upd(id, 'ERR'); });
        ws.addEventListener('message', function (ev) { add('ws', '← ' + url, cut(ev.data, 200)); });
        var send = ws.send;
        ws.send = function (d) { add('ws', '→ ' + url, cut(d, 200)); return send.apply(ws, arguments); };
        return ws;
      };
      NW.prototype = WS.prototype;
      NW.CONNECTING = 0; NW.OPEN = 1; NW.CLOSING = 2; NW.CLOSED = 3;
      window.WebSocket = NW;
    }

    function fmt(v) {
      if (v === undefined) return 'undefined';
      if (typeof v === 'function') return cut(v.toString(), 500);
      try { if (typeof v === 'object') return cut(JSON.stringify(v, null, 2), 3000); } catch (e) {}
      return cut(String(v), 3000);
    }
    document.addEventListener('__nd_exec', function (ev) {
      var code = String(ev.detail), id = add('console', '> ' + cut(code, 500), '', '…');
      try {
        var r = (0, eval)(code);
        if (r && typeof r.then === 'function') r.then(function (v) { upd(id, '=', fmt(v)); }, function (e) { upd(id, 'ERR', String(e)); });
        else upd(id, '=', fmt(r));
      } catch (e) { upd(id, 'ERR', String(e && e.stack || e)); }
    });
    document.documentElement.setAttribute('data-nd', '1');

    window.addEventListener('error', function (ev) {
      var t = ev.target;
      if (t && t !== window && (t.src || t.href)) add('error', '资源加载失败 <' + t.tagName.toLowerCase() + '>', t.src || t.href, 'ERR');
      else add('error', ev.message, (ev.filename || '') + ':' + ev.lineno, 'JS');
    }, true);
    window.addEventListener('unhandledrejection', function (ev) { add('error', 'Promise 未处理拒绝', str(ev.reason), 'JS'); });
    ['warn', 'error'].forEach(function (k) {
      var o = console[k];
      console[k] = function () {
        try { add('console', k, cut([].slice.call(arguments).map(str).join(' '), 300), k); } catch (e) {}
        return o.apply(console, arguments);
      };
    });
  }

  var hookOK = false;
  try {
    var sc = document.createElement('script');
    sc.textContent = '(' + pageHook.toString() + ')();';
    (document.head || document.documentElement).appendChild(sc);
    sc.remove();
    hookOK = document.documentElement.getAttribute('data-nd') === '1';
  } catch (e) { hookOK = false; }

  // ========== 日志模型 ==========
  var logs = [], byId = {}, MAX = 800, seq = 0, filter = 'all', open = false;
  var panel, listEl, badge, fab, t0 = Date.now();

  function ts() { return ((Date.now() - t0) / 1000).toFixed(2) + 's'; }
  function cut(s, n) { s = String(s); return s.length > n ? s.slice(0, n) + '…' : s; }
  function add(type, title, detail, status, id) {
    var e = { id: id || 'c' + (++seq), type: type, title: title, detail: detail || '', status: status === undefined ? '' : status, time: ts() };
    logs.push(e); byId[e.id] = e;
    if (logs.length > MAX) { var d = logs.shift(); delete byId[d.id]; }
    refresh(); return e;
  }
  function upd(e, status, detail) {
    if (!e) return;
    if (status !== undefined) e.status = status;
    if (detail !== undefined) e.detail = detail;
    refresh();
  }
  var pending = false;
  function refresh() {
    if (badge) badge.textContent = logs.length;
    if (!open || pending) return;
    pending = true;
    setTimeout(function () { pending = false; render(); }, 120);
  }

  document.addEventListener('__nd_evt', function (ev) {
    try {
      var o = JSON.parse(ev.detail);
      if (o.k === 'add') add(o.type, o.title, o.detail, o.status, o.id);
      else if (o.k === 'upd') upd(byId[o.id], o.status, o.detail);
    } catch (e) {}
  });

  // 钩子注入失败（如页面 CSP）时的降级：用资源计时观察请求
  if (!hookOK && window.PerformanceObserver) {
    try {
      new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (x) {
          add('res', x.initiatorType + ' ' + x.name, Math.round(x.duration) + 'ms | ' + (x.nextHopProtocol || '') + ' | ' + Math.round((x.transferSize || 0) / 1024) + 'KB', '✓');
        });
      }).observe({ type: 'resource', buffered: true });
    } catch (e) {}
  }

  // ========== 信息采集 ==========
  function envInfo() {
    var c = navigator.connection || {};
    var n = (performance.getEntriesByType('navigation') || [])[0];
    var L = [
      'URL: ' + location.href,
      'UA: ' + navigator.userAgent,
      '在线: ' + navigator.onLine + ' | 语言: ' + navigator.language,
      '网络: ' + (c.effectiveType || 'n/a') + (c.downlink ? ' ' + c.downlink + 'Mbps' : '') + (c.rtt ? ' rtt=' + c.rtt : ''),
      '安全上下文: ' + window.isSecureContext + ' | Cookie: ' + navigator.cookieEnabled,
      'Referrer: ' + (document.referrer || '(无)'),
      '请求钩子: ' + (hookOK ? '已注入页面世界' : '注入失败（可能被 CSP 拦截），仅资源计时降级')
    ];
    if (n) L.push('--- 导航耗时 ---',
      'DNS ' + Math.round(n.domainLookupEnd - n.domainLookupStart) + 'ms | TCP ' + Math.round(n.connectEnd - n.connectStart) +
      'ms | TLS ' + (n.secureConnectionStart ? Math.round(n.connectEnd - n.secureConnectionStart) : 0) + 'ms',
      'TTFB ' + Math.round(n.responseStart - n.requestStart) + 'ms | 下载 ' + Math.round(n.responseEnd - n.responseStart) +
      'ms | Load ' + Math.round(n.loadEventEnd) + 'ms | 协议 ' + (n.nextHopProtocol || '?'));
    return L.join('\n');
  }
  function slowRes() {
    var r = performance.getEntriesByType('resource').slice().sort(function (a, b) { return b.duration - a.duration; }).slice(0, 15);
    return r.map(function (x) {
      return Math.round(x.duration) + 'ms ' + (x.nextHopProtocol || '') + ' ' + Math.round((x.transferSize || 0) / 1024) + 'KB ' + cut(x.name, 120);
    }).join('\n') || '(无)';
  }

  // GM.xmlHttpRequest：不受 CORS 限制，可拿真实状态码、响应头、最终 URL
  function gmReq(url, opt) {
    opt = opt || {};
    return new Promise(function (resolve) {
      var s = performance.now();
      try {
        GM.xmlHttpRequest({
          method: opt.method || 'GET', url: url, timeout: opt.timeout || 10000,
          headers: opt.headers, responseType: 'text',
          onload: function (r) { resolve({ ok: true, ms: Math.round(performance.now() - s), r: r }); },
          onerror: function (r) { resolve({ ok: false, ms: Math.round(performance.now() - s), err: '请求失败', r: r }); },
          ontimeout: function () { resolve({ ok: false, ms: Math.round(performance.now() - s), err: '超时' }); },
          onabort: function () { resolve({ ok: false, ms: Math.round(performance.now() - s), err: '中止' }); }
        });
      } catch (e) { resolve({ ok: false, ms: 0, err: String(e && e.message || e) }); }
    });
  }
  async function probe(url, method) {
    var e = add('test', '探测 ' + (method || 'GET') + ' ' + url, '', '…');
    var times = [], last = null, N = 3;
    for (var i = 0; i < N; i++) {
      var u = url;
      var res = await gmReq(u, { method: method || 'GET' });
      if (res.ok) { times.push(res.ms); last = res; } else { times.push(res.err); last = last || res; }
      upd(e, '…' + (i + 1) + '/' + N);
    }
    var nums = times.filter(function (x) { return typeof x === 'number'; });
    var avg = nums.length ? Math.round(nums.reduce(function (a, b) { return a + b; }, 0) / nums.length) : 0;
    var d = '耗时: ' + times.join(' / ') + (nums.length ? ' | 平均 ' + avg + 'ms' : '');
    var st = 'ERR';
    if (last && last.ok) {
      st = last.r.status;
      d += '\n状态: ' + last.r.status + ' ' + (last.r.statusText || '') + '\n最终URL: ' + (last.r.finalUrl || last.r.responseURL || url) +
        '\n响应头:\n' + cut(last.r.responseHeaders || '', 1500);
    }
    upd(e, st, d);
  }
  async function traceInfo() {
    var e = add('info', '出口信息 (Cloudflare trace)', '', '…');
    var r = await gmReq('https://1.1.1.1/cdn-cgi/trace', { timeout: 8000 });
    if (r.ok) upd(e, r.r.status, r.ms + 'ms\n' + cut(r.r.responseText || '', 800));
    else upd(e, 'ERR', r.err);
  }
  async function cookieInfo() {
    var e = add('cookie', 'Cookie 列表', '', '…');
    var cs = null, note = '';
    try { cs = await GM.cookie.list({ url: location.href }); }
    catch (er) {
      note = 'GM.cookie 失败(' + (er && er.message || er) + ')，降级为 document.cookie，不含 HttpOnly\n';
      cs = document.cookie ? document.cookie.split(/;\s*/).map(function (p) {
        var i = p.indexOf('='); return { name: p.slice(0, i), value: p.slice(i + 1) };
      }) : [];
    }
    var header = cs.map(function (c) { return c.name + '=' + c.value; }).join('; ');
    var detail = note + cs.map(function (c, i) {
      var attrs = [];
      if (c.domain) attrs.push('domain=' + c.domain);
      if (c.path) attrs.push('path=' + c.path);
      if (c.secure) attrs.push('Secure');
      if (c.httpOnly) attrs.push('HttpOnly');
      if (c.sameSite) attrs.push('SameSite=' + c.sameSite);
      if (c.expirationDate) attrs.push('expires=' + new Date(c.expirationDate * 1000).toISOString());
      else if (c.session) attrs.push('session');
      return (i + 1) + '. ' + c.name + ' = ' + c.value + (attrs.length ? '\n    ' + attrs.join(' | ') : '');
    }).join('\n') || '(无)';
    e.actions = [
      { label: '复制全部(请求头格式)', text: header },
      { label: '复制JSON', text: JSON.stringify(cs, null, 2) }
    ].concat(cs.map(function (c) { return { label: '复制 ' + c.name, text: c.name + '=' + c.value }; }));
    upd(e, cs.length + ' 条', detail);
  }

  function runCode(code) {
    code = (code || '').trim();
    if (!code) return;
    if (hookOK) { document.dispatchEvent(new CustomEvent('__nd_exec', { detail: code })); return; }
    // 降级：钩子不可用（CSP），在扩展隔离环境执行，无法访问页面变量
    var e = add('console', '> ' + cut(code, 500) + '  (隔离环境)', '', '…');
    try {
      var r = (0, eval)(code);
      Promise.resolve(r).then(function (v) { upd(e, '=', v === undefined ? 'undefined' : (typeof v === 'object' ? cut(JSON.stringify(v, null, 2), 3000) : cut(String(v), 3000))); },
        function (er) { upd(e, 'ERR', String(er)); });
    } catch (er) { upd(e, 'ERR', String(er && er.stack || er)); }
  }

  function textOf() {
    return envInfo() + '\n\n--- 最慢资源 ---\n' + slowRes() + '\n\n--- 日志 ---\n' +
      logs.map(function (e) { return '[' + e.time + '] ' + e.type + ' ' + e.status + ' ' + e.title + (e.detail ? '\n    ' + e.detail.replace(/\n/g, '\n    ') : ''); }).join('\n');
  }
  async function copyText(t) {
    try { await GM.setClipboard(t); toast('已复制'); }
    catch (e) { try { await navigator.clipboard.writeText(t); toast('已复制'); } catch (e2) { toast('复制失败'); } }
  }
  function copyAll() { return copyText(textOf()); }
  async function saveAll() {
    try {
      var fm = Scripting.FileManager;
      var dir = (fm.appGroupDocumentsDirectory || fm.documentsDirectory) + '/NetDebug';
      await fm.createDirectory(dir, true);
      var p = dir + '/log-' + new Date().toISOString().replace(/[:.]/g, '-') + '.txt';
      await fm.writeAsString(p, textOf());
      toast('已保存: ' + p);
    } catch (e) { toast('保存失败: ' + (e && e.message || e)); }
  }

  // ========== UI ==========
  function el(tag, css, txt) { var d = document.createElement(tag); if (css) d.style.cssText = css; if (txt != null) d.textContent = txt; return d; }
  function toast(t) {
    var d = el('div', 'position:fixed;left:50%;top:60px;transform:translateX(-50%);background:#000c;color:#fff;padding:8px 14px;border-radius:8px;z-index:2147483647;font:13px -apple-system;max-width:90vw;word-break:break-all', t);
    document.documentElement.appendChild(d); setTimeout(function () { d.remove(); }, 2200);
  }
  function btn(txt, fn) {
    var b = el('button', 'background:#3a3a3c;color:#fff;border:0;border-radius:6px;padding:6px 10px;margin:2px;font-size:13px', txt);
    b.onclick = fn; return b;
  }
  function color(e) {
    var s = String(e.status);
    if (e.type === 'error' || /ERR|JS|失败|超时/.test(s)) return '#ff6b6b';
    if (/^[45]/.test(s) || s === 'warn') return '#ffb454';
    if (/^[23]|OPEN|✓|^=$/.test(s)) return '#6bd68a';
    return '#ccc';
  }
  function isErr(e) { return e.type === 'error' || /ERR|JS|^[45]|失败|超时|^error$/.test(String(e.status)); }
  function render() {
    if (!listEl) return;
    listEl.innerHTML = '';
    logs.filter(function (e) { return filter === 'all' || (filter === 'err' ? isErr(e) : e.type === filter); })
      .slice().reverse().slice(0, 300).forEach(function (e) {
        var row = el('div', 'padding:6px 8px;border-bottom:1px solid #333;font:12px Menlo,monospace;word-break:break-all;white-space:pre-wrap;color:' + color(e));
        row.textContent = '[' + e.time + '] ' + e.type + ' ' + e.status + '  ' + e.title + (e.detail ? '\n' + e.detail : '');
        if (e.actions && e.actions.length) {
          var ab = el('div', 'margin-top:6px;white-space:normal');
          e.actions.forEach(function (a) {
            ab.appendChild(btn(a.label, function () { copyText(a.text); }));
          });
          row.appendChild(ab);
        }
        listEl.appendChild(row);
      });
  }
  function toggle() {
    open = !open;
    panel.style.display = open ? 'flex' : 'none';
    if (open) render();
  }
  function ask(msg, def) { return window.prompt(msg, def); }
  function build() {
    GM.addStyle('#__nd_panel *{box-sizing:border-box}');
    fab = el('div', 'position:fixed;right:10px;bottom:90px;z-index:2147483646;width:44px;height:44px;border-radius:22px;background:#0a84ff;color:#fff;font:600 11px -apple-system;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.4)', 'Net');
    badge = el('span', 'position:absolute;top:-4px;right:-4px;background:#ff453a;border-radius:9px;padding:1px 5px;font-size:10px', String(logs.length));
    fab.appendChild(badge); fab.onclick = toggle;
    panel = el('div', 'display:none;position:fixed;left:0;right:0;bottom:0;height:62vh;z-index:2147483647;background:#1c1c1e;color:#eee;font-family:-apple-system;border-top:1px solid #444;flex-direction:column;padding-bottom:env(safe-area-inset-bottom)');
    panel.id = '__nd_panel';
    var bar = el('div', 'padding:4px;flex:none;overflow-x:auto;white-space:nowrap');
    ['all', 'fetch', 'xhr', 'ws', 'err', 'console', 'cookie', 'test', 'res'].forEach(function (f) { bar.appendChild(btn(f, function () { filter = f; render(); })); });
    var bar2 = el('div', 'padding:0 4px 4px;flex:none;overflow-x:auto;white-space:nowrap');
    bar2.appendChild(btn('环境', function () { add('info', '环境信息', envInfo()); }));
    bar2.appendChild(btn('慢资源', function () { add('info', '最慢资源 Top15', slowRes()); }));
    bar2.appendChild(btn('出口', traceInfo));
    bar2.appendChild(btn('探测', function () { var u = ask('探测 URL（GM 请求，无跨域限制）', location.origin + '/'); if (u) probe(u); }));
    bar2.appendChild(btn('HEAD', function () { var u = ask('HEAD 探测 URL', location.href); if (u) probe(u, 'HEAD'); }));
    bar2.appendChild(btn('Cookie', function () { filter = 'cookie'; cookieInfo(); }));
    bar2.appendChild(btn('复制', copyAll));
    bar2.appendChild(btn('保存', saveAll));
    bar2.appendChild(btn('清空', function () { logs = []; byId = {}; badge.textContent = 0; render(); }));
    bar2.appendChild(btn('关闭', toggle));
    // Console 输入行（放在上方，避免被 iOS 键盘遮挡）；字号 16px 防止 Safari 聚焦时自动放大
    var inRow = el('div', 'display:flex;flex:none;padding:2px 4px 6px;gap:4px');
    var inp = el('input', 'flex:1;min-width:0;background:#2c2c2e;color:#fff;border:1px solid #555;border-radius:6px;padding:7px 8px;font:16px Menlo,monospace');
    inp.type = 'text'; inp.placeholder = '> 输入 JS，如 document.title';
    inp.setAttribute('autocapitalize', 'off'); inp.setAttribute('autocorrect', 'off'); inp.setAttribute('spellcheck', 'false');
    var hist = [], hi = 0;
    function go() {
      var v = inp.value; if (!v.trim()) return;
      hist.push(v); hi = hist.length; filter = 'console'; runCode(v); inp.value = '';
    }
    inp.addEventListener('keydown', function (ev) {
      ev.stopPropagation();
      if (ev.key === 'Enter') { ev.preventDefault(); go(); }
      else if (ev.key === 'ArrowUp' && hi > 0) { inp.value = hist[--hi]; ev.preventDefault(); }
      else if (ev.key === 'ArrowDown') { inp.value = hi < hist.length - 1 ? hist[++hi] : ''; hi = Math.min(hi, hist.length); ev.preventDefault(); }
    });
    ['keyup', 'keypress'].forEach(function (k) { inp.addEventListener(k, function (ev) { ev.stopPropagation(); }); });
    inRow.appendChild(inp);
    inRow.appendChild(btn('运行', go));
    inRow.appendChild(btn('↑', function () { if (hi > 0) inp.value = hist[--hi]; }));
    listEl = el('div', 'flex:1;overflow:auto;-webkit-overflow-scrolling:touch');
    panel.appendChild(bar); panel.appendChild(bar2); panel.appendChild(inRow); panel.appendChild(listEl);
    document.documentElement.appendChild(panel);
    document.documentElement.appendChild(fab);
  }

  function init() {
    if (panel) return;
    build();
    add('info', '网络调试已启动', envInfo());
  }
  if (document.documentElement) init(); else document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('load', function () { setTimeout(function () { add('info', '页面加载完成', envInfo()); }, 0); });

  // Safari 扩展菜单入口（无需悬浮球也能打开）
  try {
    GM.registerMenuCommand('显示/隐藏调试面板', toggle);
    GM.registerMenuCommand('复制全部日志', copyAll);
    GM.registerMenuCommand('保存日志到文件', saveAll);
    GM.registerMenuCommand('查询出口信息', function () { if (!open) toggle(); traceInfo(); });
  } catch (e) {}
})();
