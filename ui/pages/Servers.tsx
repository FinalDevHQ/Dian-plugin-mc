import { useState, useEffect, useCallback } from "react"
import { Card, CardHeader, CardContent, Label, Input, Button, Badge } from "../components"
import { API, apiFetch } from "../api"

interface ServerEntry {
  name: string
  address: string
  type: 'java' | 'bedrock'
  enabled: boolean
  createdAt: string
}

interface ServerStatus {
  online: boolean
  address: string
  latency: number
  players: { online: number; max: number }
  version: { name: string }
  error?: string
}

export default function ServersPage({ showToast }: { showToast: (msg: string, ok?: boolean) => void }) {
  const [servers, setServers] = useState<ServerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [addName, setAddName] = useState("")
  const [addAddress, setAddAddress] = useState("")
  const [adding, setAdding] = useState(false)
  const [testingAll, setTestingAll] = useState(false)
  const [serverStatuses, setServerStatuses] = useState<Map<string, ServerStatus>>(new Map())
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editName, setEditName] = useState("")
  const [editAddress, setEditAddress] = useState("")
  const [saving, setSaving] = useState(false)

  const loadServers = useCallback(async () => {
    try {
      const r = await apiFetch(`${API}/servers`).then(r => r.json())
      if (r.ok) setServers(r.servers)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { loadServers() }, [loadServers])

  const handleAdd = async () => {
    if (!addName.trim() || !addAddress.trim()) return
    setAdding(true)

    try {
      const r = await apiFetch(`${API}/servers/add`, {
        method: "POST",
        body: JSON.stringify({ name: addName, address: addAddress, type: 'java' }),
      }).then(r => r.json())

      if (r.ok) {
        showToast("添加成功")
        setAddName("")
        setAddAddress("")
        setServers(r.servers)
      } else {
        showToast(r.error || "添加失败", false)
      }
    } catch {
      showToast("添加失败", false)
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (nameOrAddress: string) => {
    try {
      const r = await apiFetch(`${API}/servers/delete`, {
        method: "POST",
        body: JSON.stringify({ nameOrAddress }),
      }).then(r => r.json())

      if (r.ok) {
        showToast("删除成功")
        setServers(r.servers)
      } else {
        showToast(r.error || "删除失败", false)
      }
    } catch {
      showToast("删除失败", false)
    }
  }

  const startEdit = (index: number) => {
    setEditingIndex(index)
    setEditName(servers[index].name)
    setEditAddress(servers[index].address)
  }

  const cancelEdit = () => {
    setEditingIndex(null)
    setEditName("")
    setEditAddress("")
  }

  const handleSave = async () => {
    if (editingIndex === null || (!editName.trim() && !editAddress.trim())) return
    setSaving(true)

    try {
      const original = servers[editingIndex]
      const r = await apiFetch(`${API}/servers/update`, {
        method: "POST",
        body: JSON.stringify({
          nameOrAddress: original.name,
          name: editName.trim() || undefined,
          address: editAddress.trim() || undefined,
        }),
      }).then(r => r.json())

      if (r.ok) {
        showToast("保存成功")
        setServers(r.servers)
        cancelEdit()
      } else {
        showToast(r.error || "保存失败", false)
      }
    } catch {
      showToast("保存失败", false)
    } finally {
      setSaving(false)
    }
  }

  const testServer = async (address: string) => {
    try {
      const r = await apiFetch(`${API}/ping?address=${encodeURIComponent(address)}`).then(r => r.json())
      if (r.ok) {
        setServerStatuses(prev => new Map(prev).set(address, r.status))
      }
    } catch { /* ignore */ }
  }

  const testAllServers = async () => {
    setTestingAll(true)
    const promises = servers.map(s => testServer(s.address))
    await Promise.all(promises)
    setTestingAll(false)
  }

  if (loading) {
    return <p className="text-sm text-slate-400 text-center py-12">加载中...</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">服务器列表</h1>
          <p className="text-sm text-slate-400">管理已保存的 Minecraft 服务器</p>
        </div>
        <Button onClick={testAllServers} disabled={testingAll} variant="secondary">
          {testingAll ? "测试中..." : "批量测试"}
        </Button>
      </div>

      {/* 添加服务器 */}
      <Card>
        <CardHeader>
          <Label>添加服务器</Label>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="名称（如：海岛）"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              className="sm:w-48"
            />
            <Input
              placeholder="地址（如：mc.hypixel.net:25566）"
              value={addAddress}
              onChange={(e) => setAddAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="flex-1"
            />
            <Button onClick={handleAdd} disabled={adding || !addName.trim() || !addAddress.trim()}>
              {adding ? "添加中..." : "添加"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 服务器列表 */}
      {servers.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-slate-400">暂无服务器，使用上方表单添加</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {servers.map((server, i) => {
            const status = serverStatuses.get(server.address)
            const isEditing = editingIndex === i
            return (
              <Card key={i}>
                <CardContent className="py-4">
                  {isEditing ? (
                    /* 编辑模式 */
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Input
                          placeholder="名称"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="sm:w-48"
                        />
                        <Input
                          placeholder="地址"
                          value={editAddress}
                          onChange={(e) => setEditAddress(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSave()}
                          className="flex-1"
                        />
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        <Button variant="ghost" onClick={cancelEdit} className="text-xs">
                          取消
                        </Button>
                        <Button onClick={handleSave} disabled={saving} className="text-xs">
                          {saving ? "保存中..." : "保存"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* 展示模式 */
                    <div className="flex items-center gap-4">
                      {/* 状态指示器 */}
                      <div className={`w-3 h-3 rounded-full ${
                        status?.online ? 'bg-emerald-500' : status ? 'bg-red-500' : 'bg-slate-300'
                      }`} />

                      {/* 服务器信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{server.name}</span>
                          <Badge className={server.type === 'java' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-purple-200 bg-purple-50 text-purple-700'}>
                            {server.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{server.address}</p>
                      </div>

                      {/* 状态信息 */}
                      {status && (
                        <div className="hidden sm:flex items-center gap-4 text-sm">
                          {status.online ? (
                            <>
                              <span className="text-emerald-600">🟢 在线</span>
                              <span className="text-slate-500">{status.players.online}/{status.players.max}</span>
                              <span className="text-slate-500">{status.latency}ms</span>
                              <span className="text-slate-400">{status.version.name}</span>
                            </>
                          ) : (
                            <span className="text-red-500">🔴 {status.error || "离线"}</span>
                          )}
                        </div>
                      )}

                      {/* 操作按钮 */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => testServer(server.address)}
                          className="text-xs"
                        >
                          测试
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => startEdit(i)}
                          className="text-xs"
                        >
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleDelete(server.name)}
                          className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          删除
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
