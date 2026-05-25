import { useState, useEffect, useCallback } from "react"
import { Card, CardHeader, CardContent, Label, Input, Button } from "../components"
import { API, apiFetch } from "../api"

interface Config {
  command: string
  reply: string
  muteCommand: string
  muteDuration: number
}

export default function ConfigPage({ showToast }: { showToast: (msg: string, ok?: boolean) => void }) {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await apiFetch(`${API}/status`).then((r) => r.json()) as { config: Config }
      setCfg(r.config)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!cfg || !cfg.command.trim() || !cfg.reply.trim()) return
    setSaving(true)
    try {
      await apiFetch(`${API}/config`, {
        method: "POST",
        body: JSON.stringify(cfg),
      })
      showToast("保存成功")
      load()
    } catch {
      showToast("保存失败", false)
    } finally {
      setSaving(false)
    }
  }

  if (!cfg) return <p className="text-sm text-slate-400 text-center py-12">加载中...</p>

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-slate-900">基础配置</h1>

      <Card>
        <CardHeader>
          <Label>!hello 配置</Label>
          <p className="text-xs text-slate-400">「触发指令」和「回复内容」均立即生效，无需重启</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-slate-500">触发指令</label>
              <Input
                placeholder="!hello"
                value={cfg.command}
                onChange={(e) => setCfg({ ...cfg, command: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && save()}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-slate-500">回复内容</label>
              <Input
                placeholder="Hello World"
                value={cfg.reply}
                onChange={(e) => setCfg({ ...cfg, reply: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && save()}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Label>!mute 配置</Label>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-slate-500">触发指令</label>
              <Input
                placeholder="!mute"
                value={cfg.muteCommand}
                onChange={(e) => setCfg({ ...cfg, muteCommand: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && save()}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-slate-500">禁言时长（秒）</label>
              <Input
                type="number"
                min={1}
                placeholder="60"
                value={cfg.muteDuration}
                onChange={(e) => setCfg({ ...cfg, muteDuration: parseInt(e.target.value) || 60 })}
                onKeyDown={(e) => e.key === "Enter" && save()}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={save}
                disabled={saving || !cfg.command.trim() || !cfg.reply.trim()}
                className="w-full sm:w-auto"
              >
                {saving ? "保存中..." : "保存配置"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
