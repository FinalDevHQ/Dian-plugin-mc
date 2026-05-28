import { useState, useEffect, useCallback } from "react"
import { Card, CardHeader, CardContent, Label, Input, Button, Badge, StatCard } from "../components"
import { API, apiFetch } from "../api"

interface ServerStatus {
  online: boolean
  address: string
  host: string
  port: number
  latency: number
  version: { name: string; protocol: number }
  players: { online: number; max: number }
  description: string
  descriptionHtml: string
  favicon?: string
  queriedAt: string
  error?: string
}

interface ServerEntry {
  name: string
  address: string
  type: 'java' | 'bedrock'
  enabled: boolean
  createdAt: string
}

interface PluginConfig {
  defaultPort: number
  timeout: number
  cacheTTL: number
}

export default function Dashboard() {
  const [config, setConfig] = useState<PluginConfig | null>(null)
  const [servers, setServers] = useState<ServerEntry[]>([])
  const [queryAddress, setQueryAddress] = useState("")
  const [querying, setQuerying] = useState(false)
  const [queryResult, setQueryResult] = useState<ServerStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [configR, serversR] = await Promise.all([
        apiFetch(`${API}/config`).then(r => r.json()),
        apiFetch(`${API}/servers`).then(r => r.json()),
      ])
      if (configR.ok) setConfig(configR.config)
      if (serversR.ok) setServers(serversR.servers)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleQuery = async () => {
    if (!queryAddress.trim()) return
    setQuerying(true)
    setError(null)
    setQueryResult(null)

    try {
      const r = await apiFetch(`${API}/ping?address=${encodeURIComponent(queryAddress)}`).then(r => r.json())
      if (r.ok) {
        setQueryResult(r.status)
      } else {
        setError(r.error || "查询失败")
      }
    } catch {
      setError("无法连接到插件 API")
    } finally {
      setQuerying(false)
    }
  }

  const onlineServers = servers.filter(s => s.enabled).length

  return (
    <div className="flex flex-col gap-6">
      {/* 页头 */}
      <div className="flex items-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white text-2xl shadow-md">
          🎮
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">MC 服务器查询</h1>
          <p className="text-sm text-slate-400 mt-0.5">查询 Minecraft 服务器状态</p>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="已保存服务器"
          value={servers.length ?? "—"}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1"/><circle cx="6" cy="18" r="1"/></svg>}
        />
        <StatCard
          label="默认端口"
          value={config?.defaultPort ?? "—"}
          mono
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
        />
        <StatCard
          label="查询超时"
          value={`${config?.timeout ?? "—"}ms`}
          mono
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><circle cx="12" cy="12" r="9"/><polyline points="12,7 12,12 15,15"/></svg>}
        />
      </div>

      {/* 快速查询 */}
      <Card>
        <CardHeader>
          <Label>快速查询</Label>
          <p className="text-xs text-slate-400">输入服务器地址查询状态</p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="mc.hypixel.net 或 play.example.com:25566"
              value={queryAddress}
              onChange={(e) => setQueryAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuery()}
              className="flex-1"
            />
            <Button onClick={handleQuery} disabled={querying || !queryAddress.trim()}>
              {querying ? "查询中..." : "查询"}
            </Button>
          </div>

          {/* 查询结果 */}
          {queryResult && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex items-start gap-4">
                {queryResult.favicon ? (
                  <img src={queryResult.favicon} className="w-16 h-16 rounded-lg" alt="Server Icon" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-slate-200 flex items-center justify-center text-2xl">
                    🎮
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      queryResult.online
                        ? "bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-500/20"
                        : "bg-red-50 text-red-600 ring-1 ring-inset ring-red-500/20"
                    }`}>
                      {queryResult.online ? "🟢 在线" : "🔴 离线"}
                    </span>
                    <span className="text-sm font-mono text-slate-500">{queryResult.address}</span>
                  </div>

                  {queryResult.online ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-slate-400">在线玩家</p>
                        <p className="text-lg font-bold text-slate-900">{queryResult.players.online.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">最大人数</p>
                        <p className="text-lg font-bold text-slate-900">{queryResult.players.max.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">延迟</p>
                        <p className="text-lg font-bold text-slate-900">{queryResult.latency}ms</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">版本</p>
                        <p className="text-sm font-medium text-slate-900">{queryResult.version.name}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-red-500">{queryResult.error || "无法连接到服务器"}</p>
                  )}

                  {queryResult.description && (
                    <div className="mt-3 text-sm text-slate-600" dangerouslySetInnerHTML={{ __html: queryResult.descriptionHtml }} />
                  )}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 最近查询的服务器 */}
      {servers.length > 0 && (
        <Card>
          <CardHeader>
            <Label>已保存的服务器</Label>
            <p className="text-xs text-slate-400">点击快速查询</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {servers.slice(0, 6).map((server, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setQueryAddress(server.address)
                    handleQuery()
                  }}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-lg">
                    🎮
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{server.name}</p>
                    <p className="text-xs text-slate-400 font-mono truncate">{server.address}</p>
                  </div>
                  <Badge className={server.type === 'java' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-purple-200 bg-purple-50 text-purple-700'}>
                    {server.type}
                  </Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
