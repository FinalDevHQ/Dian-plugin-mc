import { useState, useEffect, useCallback } from "react"
import { Card, CardHeader, CardContent, Label, Button, Badge } from "../components"
import { API, apiFetch } from "../api"

interface ServerStatus {
  online: boolean
  address: string
  latency: number
  players: { online: number; max: number }
  version: { name: string }
  queriedAt: string
  error?: string
}

interface QueryRecord {
  address: string
  status: ServerStatus
  timestamp: string
}

export default function HistoryPage() {
  const [history, setHistory] = useState<QueryRecord[]>([])
  const [loading, setLoading] = useState(true)

  const loadHistory = useCallback(async () => {
    try {
      const r = await apiFetch(`${API}/history`).then(r => r.json())
      if (r.ok) setHistory(r.history)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  const formatTime = (iso: string) => {
    const date = new Date(iso)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const clearHistory = async () => {
    try {
      await apiFetch(`${API}/history`, { method: "DELETE" })
      setHistory([])
    } catch { /* ignore */ }
  }

  if (loading) {
    return <p className="text-sm text-slate-400 text-center py-12">加载中...</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">查询历史</h1>
          <p className="text-sm text-slate-400">最近 50 条查询记录</p>
        </div>
        {history.length > 0 && (
          <Button variant="secondary" onClick={clearHistory}>
            清空历史
          </Button>
        )}
      </div>

      {history.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-12 h-12 mx-auto text-slate-300 mb-4">
                <circle cx="12" cy="12" r="9"/>
                <polyline points="12,7 12,12 15,15"/>
              </svg>
              <p className="text-slate-400">暂无查询记录</p>
              <p className="text-sm text-slate-300 mt-1">使用 mc ping 或 mc 状态 查询服务器</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {history.map((record, i) => (
            <Card key={i}>
              <CardContent className="py-3">
                <div className="flex items-center gap-4">
                  {/* 状态指示 */}
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    record.status.online ? 'bg-emerald-500' : 'bg-red-500'
                  }`} />

                  {/* 服务器信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 font-mono">
                        {record.address}
                      </span>
                      <Badge className={
                        record.status.online
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-red-200 bg-red-50 text-red-700'
                      }>
                        {record.status.online ? '在线' : '离线'}
                      </Badge>
                    </div>

                    {record.status.online && (
                      <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                        <span>👥 {record.status.players.online}/{record.status.players.max}</span>
                        <span>⏱ {record.status.latency}ms</span>
                        <span>📋 {record.status.version.name}</span>
                      </div>
                    )}

                    {!record.status.online && record.status.error && (
                      <p className="text-xs text-red-400 mt-1">{record.status.error}</p>
                    )}
                  </div>

                  {/* 查询时间 */}
                  <div className="text-xs text-slate-400">
                    {formatTime(record.timestamp)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
