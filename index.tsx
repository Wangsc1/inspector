import { Button, List, Navigation, NavigationStack, Script, Section, Text, TextField, useState } from "scripting"

const VERSION = "0.3.2"

type Ck = {
  name: string
  value: string
  domain: string
  path: string
  isSecure: boolean
  isHTTPOnly: boolean
  isSessionOnly: boolean
  expiresDate?: Date | null
}

function fmtDate(d?: Date | null): string {
  if (!d) return "会话"
  try { return new Date(d as any).toISOString().replace("T", " ").slice(0, 19) + "Z" } catch (e) { return String(d) }
}

function maskValue(v: string): string {
  if (!v) return "(空)"
  if (v.length <= 12) return "*".repeat(v.length) + " (" + v.length + "字符)"
  return v.slice(0, 4) + "…" + v.slice(-4) + " (" + v.length + "字符)"
}

function initialUrl(): string {
  const def = "https://immtele.com/clientarea.php"
  try {
    const q = Script.queryParameters as Record<string, any> | null
    const u = q && typeof q.url === "string" ? q.url.trim() : ""
    if (/^https?:\/\//i.test(u)) return u
  } catch (e) {}
  return def
}

let activeController: WebViewController | null = null

function View() {
  const [url, setUrl] = useState(initialUrl())
  const [cookies, setCookies] = useState<Ck[]>([])
  const [requestCookies, setRequestCookies] = useState<Ck[]>([])
  const [busy, setBusy] = useState(false)
  const fromTool = (() => { try { const q = Script.queryParameters as any; return !!(q && typeof q.url === "string" && q.url) } catch (e) { return false } })()
  const [status, setStatus] = useState(fromTool
    ? "已从开发者工具带入网址。点「打开并登录」，在网页里登录，关闭网页后点「读取 Cookie」"
    : "填写网址，点「打开并登录」，在网页里手动登录，关闭网页后点「读取 Cookie」")
  const [showValue, setShowValue] = useState(false)
  const [wv, setWv] = useState<WebViewController | null>(null)

  async function openLogin() {
    if (busy) return
    setBusy(true)
    try {
      const u = new URL(url.trim())
      if (!/^https?:$/.test(u.protocol)) throw new Error("只支持 HTTP/HTTPS 网址")
      const c = wv || new WebViewController()
      activeController = c
      setWv(c)
      setCookies([]); setRequestCookies([])
      setStatus("正在加载…")
      const ok = await c.loadURL(u.href)
      setStatus(ok ? "页面已加载，请在网页中登录。登录完成后关闭网页，再点「读取 Cookie」" : "加载失败（可能被网站拦截），仍可尝试登录后读取")
      await c.present({ navigationTitle: "登录后关闭本页" })
      setStatus("网页已关闭，现在点「读取 Cookie」")
    } catch (e: any) {
      setStatus("打开失败：" + String(e && e.message || e))
    } finally { setBusy(false) }
  }

  async function read() {
    if (busy) return
    if (!wv) { setStatus("请先打开网页"); return }
    setBusy(true)
    try {
      setStatus("读取中…")
      const all = (await wv.getAllCookies()) as Ck[]
      const target = new URL(url.trim())
      const host = target.hostname.toLowerCase()
      const list = all.filter(c => {
        const domain = (c.domain || "").replace(/^\./, "").toLowerCase()
        return domain !== "" && (host === domain || host.endsWith("." + domain))
      })
      // WebKit 自己判断 domain/path/secure；请求头不混入不适用于此 URL 的 Cookie
      const send = await wv.getCookies(target.href) as Ck[]
      setRequestCookies(send.slice().sort((a, b) => (b.path || "/").length - (a.path || "/").length))
      setCookies(list)
      const sess = list.filter(c => c.isSessionOnly).length
      const ho = list.filter(c => c.isHTTPOnly).length
      setStatus("共 " + all.length + " 条，其中属于 " + host + " 的 " + list.length + " 条（会话 " + sess + "，HttpOnly " + ho + "）")
    } catch (e: any) {
      setStatus("读取失败：" + String(e && e.message || e))
    } finally { setBusy(false) }
  }

  async function verifyImported() {
    if (busy) return
    setBusy(true)
    let isolated: WebViewController | null = null
    try {
      const target = new URL(url.trim())
      if (target.protocol !== "https:") throw new Error("验证仅支持 HTTPS")
      const raw = (await Pasteboard.getString() || "").trim()
      if (!raw) throw new Error("请先复制当前网站的 Cookie JSON 或请求头")
      const parsed = raw.startsWith("[") ? JSON.parse(raw) : raw.replace(/^Cookie:\s*/i, "").split(/;\s*/).filter(Boolean).map(x => {
        const i = x.indexOf("=")
        if (i <= 0) throw new Error("Cookie 请求头格式错误")
        return { name: x.slice(0, i), value: x.slice(i + 1), domain: target.hostname, path: "/", isSecure: true, isHTTPOnly: true, isSessionOnly: true }
      })
      if (!Array.isArray(parsed) || !parsed.length) throw new Error("没有可导入的 Cookie")
      const host = target.hostname.toLowerCase()
      const imported: Ck[] = parsed.map(c => {
        if (!c || typeof c.name !== "string" || !c.name || typeof c.value !== "string") throw new Error("Cookie 名称或值无效")
        const domain = String(c.domain || host), clean = domain.replace(/^\./, "").toLowerCase()
        if (!clean || !(host === clean || (domain.startsWith(".") && host.endsWith("." + clean)))) throw new Error("Cookie 域名不属于当前网址")
        const expiry = c.expiresDate ? new Date(c.expiresDate) : typeof c.expirationDate === "number" && c.expirationDate > 0 ? new Date(c.expirationDate * 1000) : null
        if (expiry && (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now())) throw new Error("Cookie 已过期或过期时间无效")
        return { name: c.name, value: c.value, domain, path: c.path || "/", isSecure: c.isSecure ?? c.secure ?? true, isHTTPOnly: c.isHTTPOnly ?? c.httpOnly ?? true, isSessionOnly: expiry ? false : true, expiresDate: expiry }
      })
      isolated = new WebViewController({ ephemeral: true })
      if ((await isolated.getAllCookies()).length) throw new Error("隔离存储并非空，已停止验证")
      for (const c of imported) if (!await isolated.setCookie(c)) throw new Error("Cookie 注入失败：" + c.name)
      const sent = await isolated.getCookies(target.href)
      if (!sent.length) throw new Error("导入记录均不适用于当前网址")
      setStatus("已向隔离会话注入 " + imported.length + " 条，当前网址适用 " + sent.length + " 条。不要手动登录，观察是否显示退出账户或登录页；若遇到 Cloudflare，可完成验证，但不要输入账号密码。")
      await isolated.loadURL(target.href)
      await isolated.present({ navigationTitle: "隔离验证：不要手动登录" })
      const result = await isolated.evaluateJavaScript<{ title: string, url: string, ua: string, logout: boolean, login: boolean }>("return {title:document.title,url:location.href,ua:navigator.userAgent,logout:(document.body.innerText||'').includes('退出账户'),login:!!document.querySelector('input[type=password]')}")
      setStatus("隔离验证结束：" + (result.logout ? "发现退出账户文字（登录线索）" : result.login ? "发现登录密码框（尚未恢复登录）" : "页面状态不明确") + "。标题：" + result.title + "；网址：" + result.url + "；UA：" + result.ua + "。请把此状态反馈；不会保存导入 Cookie，也未改动原 WebView 登录。")
    } catch (e: any) {
      setStatus("隔离验证失败：" + String(e && e.message || e))
    } finally { if (isolated) isolated.dispose(); setBusy(false) }
  }

  async function copyText(t: string, tip: string) {
    if (!t) { setStatus("当前网址没有可复制的 Cookie，请先读取"); return }
    try { await Pasteboard.setString(t); setStatus("已复制：" + tip) } catch (e: any) { setStatus("复制失败：" + String(e && e.message || e)) }
  }

  const header = requestCookies.map(c => c.name + "=" + c.value).join("; ")

  return <NavigationStack>
    <List navigationTitle={"Cookie 读取 " + VERSION} navigationBarTitleDisplayMode={"inline"}>
      <Section header={<Text>网址</Text>}>
        <TextField title="登录网址" value={url} onChanged={(v) => { setUrl(v); setCookies([]); setRequestCookies([]) }} />
        <Button title="打开网页（可复用已有登录）" action={openLogin} />
        <Button title="读取 Cookie" action={read} />
        <Button title="用剪贴板 Cookie 验证独立会话" action={verifyImported} />
      </Section>
      <Section header={<Text>状态</Text>}>
        <Text>{status}</Text>
      </Section>
      {cookies.length > 0 ? <Section header={<Text>操作</Text>}>
        <Button title={showValue ? "隐藏值（仅显示首尾）" : "显示完整值"} action={() => setShowValue(!showValue)} />
        <Button title="复制当前网址 Cookie 请求头" action={() => copyText(header, "请求头格式 " + header.length + " 字符")} />
        <Button title="复制 JSON" action={() => copyText(JSON.stringify(cookies, null, 2), "JSON")} />
      </Section> : null}
      {cookies.map((c, i) => <Section key={i} header={<Text>{c.name}</Text>}>
        <Text>{showValue ? c.value : maskValue(c.value)}</Text>
        <Text>{"domain=" + c.domain + " | path=" + c.path}</Text>
        <Text>{(c.isHTTPOnly ? "HttpOnly " : "") + (c.isSecure ? "Secure " : "") + (c.isSessionOnly ? "会话Cookie " : "") + "过期=" + fmtDate(c.expiresDate)}</Text>
        <Button title="复制 name=value" action={() => copyText(c.name + "=" + c.value, c.name)} />
      </Section>)}
    </List>
  </NavigationStack>
}

async function run() {
  try { await Navigation.present({ element: <View /> }) }
  finally { if (activeController) activeController.dispose(); Script.exit() }
}

run()
