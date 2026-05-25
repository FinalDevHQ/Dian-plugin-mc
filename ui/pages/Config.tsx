import { useState, useEffect, useCallback } from "react"
import { Card, CardHeader, CardContent, Label, Input, Button } from "../components"
import { API, apiFetch } from "../api"

interface PluginConfig {
  servers: any[]
  defaultPort: number
  timeout: number
  maxRetries: number
  cacheTTL: number
  owners: string[]
  debug: boolean
  imageMode: boolean
  puppeteerUrl: string
}

export default function ConfigPage({ showToast }: { showToast: (msg: string, ok?: boolean) => void }) {
  const [cfg, setCfg] = useState<PluginConfig | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await apiFetch(`${API}/config`).then(r => r.json())
      if (r.ok) setCfg(r.config)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!cfg) return
    setSaving(true)

    try {
      const r = await apiFetch(`${API}/config`, {
        method: "POST",
        body: JSON.stringify(cfg),
      }).then(r => r.json())

      if (r.ok) {
        showToast("保存成功")
        setCfg(r.config)
      } else {
        showToast(r.error || "保存失败", false)
      }
    } catch {
      showToast("保存失败", false)
    } finally {
      setSaving(false)
    }
  }

  if (!cfg) {
    return <p className="text-sm text-slate-400 text-center py-12">加载中...</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">插件配置</h1>
        <p className="text-sm text-slate-400">配置 MC 查询插件的参数</p>
      </div>

      {/* 查询配置 */}
      <Card>
        <CardHeader>
          <Label>查询配置</Label>
          <p className="text-xs text-slate-400">配置服务器查询的默认参数</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-slate-500">默认端口</label>
              <Input
                type="number"
                min={1}
                max={65535}
                placeholder="25565"
                value={cfg.defaultPort}
                onChange={(e) => setCfg({ ...cfg, defaultPort: parseInt(e.target.value) || 25565 })}
              />
              <p className="text-[11px] text-slate-400">未指定端口时使用此端口</p>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-slate-500">查询超时（毫秒）</label>
              <Input
                type="number"
                min={1000}
                max={30000}
                placeholder="5000"
                value={cfg.timeout}
                onChange={(e) => setCfg({ ...cfg, timeout: parseInt(e.target.value) || 5000 })}
              />
              <p className="text-[11px] text-slate-400">连接超时时间，建议 3000-10000ms</p>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-slate-500">最大重试次数</label>
              <Input
                type="number"
                min={0}
                max={5}
                placeholder="2"
                value={cfg.maxRetries}
                onChange={(e) => setCfg({ ...cfg, maxRetries: parseInt(e.target.value) || 2 })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-slate-500">缓存有效期（秒）</label>
              <Input
                type="number"
                min={0}
                max={300}
                placeholder="30"
                value={cfg.cacheTTL}
                onChange={(e) => setCfg({ ...cfg, cacheTTL: parseInt(e.target.value) || 30 })}
              />
              <p className="text-[11px] text-slate-400">相同地址在此时间内不重复查询</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 调试配置 */}
      <Card>
        <CardHeader>
          <Label>调试配置</Label>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={cfg.debug}
                onChange={(e) => setCfg({ ...cfg, debug: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
            <div>
              <p className="text-sm font-medium text-slate-900">启用调试日志</p>
              <p className="text-xs text-slate-400">输出详细的查询日志到控制台</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 图片渲染 */}
      <Card>
        <CardHeader>
          <Label>图片渲染</Label>
          <p className="text-xs text-slate-400">通过 Puppeteer 将指令输出渲染为图片</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={cfg.imageMode}
                  onChange={(e) => setCfg({ ...cfg, imageMode: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
              <div>
                <p className="text-sm font-medium text-slate-900">图片模式</p>
                <p className="text-xs text-slate-400">帮助、列表等指令以图片形式发送（需要 Puppeteer 插件）</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-slate-500">Puppeteer 地址</label>
              <Input
                placeholder="http://127.0.0.1:3000"
                value={cfg.puppeteerUrl || "http://127.0.0.1:3000"}
                onChange={(e) => setCfg({ ...cfg, puppeteerUrl: e.target.value || "http://127.0.0.1:3000" })}
              />
              <p className="text-[11px] text-slate-400">Dian 服务地址，用于调用 Puppeteer 渲染 API</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "保存中..." : "保存配置"}
        </Button>
      </div>
    </div>
  )
}
