import { Button, List, Navigation, NavigationStack, Script, Section, Text, TextField, useState } from "scripting"

const VERSION = "0.2.0"

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

function View() {
  const [url, setUrl] = useState(initialUrl())
  const [cookies, setCookies] = useState<Ck[]>([])
  const fromTool = (() => { try { const q = Script.queryParameters as any; return !!(q && typeof q.url === "string" && q.url) } catch (e) { return false } })()
  const [status, setStatus] = useState(fromTool
    ? "已从开发者工具带入网址。点「打开并登录」，在网页里登录，关闭网页后点「读取 Cookie」"
    : "填写网址，点「打开并登录」，在网页里手动登录，关闭网页后点「读取 Cookie」")
  const [showValue, setShowValue] = useState(false)
  const [wv, setWv] = useState<WebViewController | null>(null)

  async function openLogin() {
    try {
      if (wv) { try { wv.dispose() } catch (e) {} }
      const c = new WebViewController()
      setWv(c)
      setStatus("正在加载…")
      const ok = await c.loadURL(url)
      setStatus(ok ? "页面已加载，请在网页中登录。登录完成后关闭网页，再点「读取 Cookie」" : "加载失败（可能被网站拦截），仍可尝试登录后读取")
      await c.present({ navigationTitle: "登录后关闭本页" })
      setStatus("网页已关闭，现在点「读取 Cookie」")
    } catch (e: any) {
      setStatus("打开失败：" + String(e && e.message || e))
    }
  }

  async function read() {
    if (!wv) { setStatus("请先点「打开并登录」"); return }
    try {
      setStatus("读取中…")
      const all = (await wv.getAllCookies()) as Ck[]
      let host = ""
      try { host = new URL(url).hostname } catch (e) {}
      const root = host.split(".").slice(-2).join(".")
      const list = all.filter(c => !root || (c.domain || "").replace(/^\./, "").endsWith(root))
      setCookies(list)
      const sess = list.filter(c => c.isSessionOnly).length
      const ho = list.filter(c => c.isHTTPOnly).length
      setStatus("共 " + all.length + " 条，其中属于 " + (root || "全部") + " 的 " + list.length + " 条（会话 " + sess + "，HttpOnly " + ho + "）")
    } catch (e: any) {
      setStatus("读取失败：" + String(e && e.message || e))
    }
  }

  async function copyText(t: string, tip: string) {
    try { await Pasteboard.setString(t); setStatus("已复制：" + tip) } catch (e: any) { setStatus("复制失败：" + String(e && e.message || e)) }
  }

  const header = cookies.map(c => c.name + "=" + c.value).join("; ")

  return <NavigationStack>
    <List navigationTitle={"Cookie 读取 " + VERSION} navigationBarTitleDisplayMode={"inline"}>
      <Section header={<Text>网址</Text>}>
        <TextField title="登录网址" value={url} onChanged={setUrl} />
        <Button title="打开并登录" action={openLogin} />
        <Button title="读取 Cookie" action={read} />
      </Section>
      <Section header={<Text>状态</Text>}>
        <Text>{status}</Text>
      </Section>
      {cookies.length > 0 ? <Section header={<Text>操作</Text>}>
        <Button title={showValue ? "隐藏值（仅显示首尾）" : "显示完整值"} action={() => setShowValue(!showValue)} />
        <Button title="复制全部（请求头格式）" action={() => copyText(header, "请求头格式 " + header.length + " 字符")} />
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
  await Navigation.present({ element: <View /> })
  Script.exit()
}

run()
