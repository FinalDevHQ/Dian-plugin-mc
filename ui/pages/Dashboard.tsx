import { useState, useEffect, useCallback } from "react"
import { Card, CardHeader, CardContent, Label, Badge, StatCard, RegSection, MethodBadge } from "../components"
import { API, PLUGINS_API, apiFetch } from "../api"

const PLUGIN_NAME = "hello-world"

interface PluginMetaInfo {
  name: string
  handlers: { method: string; pattern: string }[]
  commands: { name: string; pattern: string; description?: string }[]
  routes: { method: string; path: string }[]
}

interface Status {
  startTime: number
  pingCount: number
  config: { command: string; reply: string }
}

function fmtUptime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = String(Math.floor(s / 3600)).padStart(2, "0")
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0")
  const sec = String(s % 60).padStart(2, "0")
  return `${h}:${m}:${sec}`
}

export default function Dashboard() {
  const [status, setStatus] = useState<Status | null>(null)
  const [meta, setMeta] = useState<PluginMetaInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uptime, setUptime] = useState("—")

  const load = useCallback(async () => {
    try {
      const [data, metaList] = await Promise.all([
        apiFetch(`${API}/status`).then((r) => r.json()) as Promise<Status>,
        apiFetch(PLUGINS_API).then((r) => r.json()).then(
          (j: { plugins: PluginMetaInfo[] }) => j.plugins
        ).catch(() => [] as PluginMetaInfo[]),
      ])
      setStatus(data)
      setMeta(metaList.find((p) => p.name === PLUGIN_NAME) ?? null)
      setError(null)
    } catch {
      setError("无法连接到插件 API")
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!status?.startTime) return
    const start = status.startTime
    setUptime(fmtUptime(Date.now() - start))
    const t = setInterval(() => setUptime(fmtUptime(Date.now() - start)), 1000)
    return () => clearInterval(t)
  }, [status?.startTime])

  return (
    <div className="flex flex-col gap-6">
      {/* 页头 */}
      <div className="flex items-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 text-white text-2xl shadow-md">
          👋
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900">Hello World</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
              error ? "bg-red-50 text-red-600 ring-red-500/20" : "bg-emerald-50 text-emerald-600 ring-emerald-500/20"
            }`}>
              {error ? "连接失败" : status ? "运行中" : "加载中"}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-0.5">
            {error || (status ? `指令 ${status.config.command} → ${status.config.reply}` : "—")}
          </p>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="运行时长"
          value={uptime}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><circle cx="12" cy="12" r="9"/><polyline points="12,7 12,12 15,15"/></svg>}
        />
        <StatCard
          label="触发次数"
          value={status?.pingCount ?? "—"}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>}
        />
        <StatCard
          label="触发指令"
          value={status?.config.command ?? "—"}
          mono
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><polyline points="4,17 10,11 4,5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>}
        />
      </div>

      {/* 已注册信息 */}
      <Card>
        <CardHeader>
          <Label>已注册</Label>
          <p className="text-xs text-slate-400">从宿主 /plugins 接口实时获取</p>
        </CardHeader>
        <CardContent>
          {!meta ? (
            <p className="py-4 text-center text-sm text-slate-400">暂无数据</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <RegSection title="指令" count={meta.commands.length} empty="未注册指令">
                {meta.commands.map((c, i) => (
                  <div key={i} className="flex flex-col gap-0.5 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Badge className="border-sky-600/40 bg-sky-50 text-sky-700">{c.name}</Badge>
                      <code className="font-mono text-[11px] text-slate-400 truncate">{c.pattern}</code>
                    </div>
                    {c.description && <p className="text-[11px] text-slate-400 truncate">{c.description}</p>}
                  </div>
                ))}
              </RegSection>
              <RegSection title="API 路由" count={meta.routes.length} empty="未注册路由">
                {meta.routes.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2">
                    <MethodBadge method={r.method} />
                    <code className="font-mono text-[11px] truncate">
                      <span className="text-slate-400">/plugins/{PLUGIN_NAME}/api</span>
                      <span>{r.path}</span>
                    </code>
                  </div>
                ))}
              </RegSection>
              <RegSection title="事件处理器" count={meta.handlers.length} empty="未注册 @Handler">
                {meta.handlers.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2">
                    <Badge className="border-violet-600/40 bg-violet-50 text-violet-700 font-mono">{h.method}</Badge>
                    <code className="font-mono text-[11px] text-slate-400 truncate">{h.pattern}</code>
                  </div>
                ))}
              </RegSection>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
