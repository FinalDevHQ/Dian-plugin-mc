import { useState, useEffect, useCallback } from "react"
import { Card, CardHeader, CardContent, Label, Badge } from "../components"
import { API, apiFetch } from "../api"

interface RecentPing {
  sender: string
  userId?: string
  group?: string
  platform?: string
  time: number
}

interface Status {
  recentPings: RecentPing[]
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

export default function LogsPage() {
  const [pings, setPings] = useState<RecentPing[]>([])

  const load = useCallback(async () => {
    try {
      const r = await apiFetch(`${API}/status`).then((r) => r.json()) as Status
      setPings(r.recentPings || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [load])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-slate-900">触发记录</h1>

      <Card className="flex-1">
        <CardHeader>
          <Label>最近触发</Label>
        </CardHeader>
        <CardContent>
          {!pings.length ? (
            <div className="py-16 text-center">
              <div className="text-4xl mb-3 opacity-30">📭</div>
              <p className="text-sm text-slate-400">暂无记录</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {pings.map((p, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 hover:bg-slate-50 transition-colors">
                  <span className="truncate font-medium text-slate-800">{p.sender}</span>
                  {p.platform && (
                    <Badge className="shrink-0 border-sky-600/40 bg-sky-50 text-sky-700">{p.platform}</Badge>
                  )}
                  {p.userId && (
                    <span className="shrink-0 font-mono text-xs text-slate-400">QQ {p.userId}</span>
                  )}
                  {p.group && (
                    <Badge className="shrink-0 border-slate-200 bg-slate-100 text-slate-500">群 {p.group}</Badge>
                  )}
                  <span className="ml-auto shrink-0 tabular-nums text-xs text-slate-400">
                    {fmtTime(p.time)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
