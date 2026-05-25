import { useState, useEffect, useCallback } from "react"
import { API, apiFetch } from "../api"

type TemplateType = "status" | "help" | "list"

const TEMPLATE_TYPES: { value: TemplateType; label: string; desc: string }[] = [
  { value: "status", label: "服务器状态", desc: "mc 状态 指令的图片输出" },
  { value: "help", label: "帮助信息", desc: "mc 帮助 指令的图片输出" },
  { value: "list", label: "服务器列表", desc: "mc 列表 指令的图片输出" },
]

const TEMPLATE_VARS: Record<TemplateType, { name: string; desc: string }[]> = {
  status: [
    { name: "address", desc: "查询地址" },
    { name: "host", desc: "主机名" },
    { name: "port", desc: "端口" },
    { name: "online", desc: "是否在线 (true/false)" },
    { name: "onlineText", desc: "在线/离线" },
    { name: "onlineEmoji", desc: "🟢/🔴" },
    { name: "statusClass", desc: "CSS 类名" },
    { name: "playersOnline", desc: "在线人数" },
    { name: "playersMax", desc: "最大人数" },
    { name: "latency", desc: "延迟 (ms)" },
    { name: "version", desc: "版本名" },
    { name: "protocol", desc: "协议号" },
    { name: "motd", desc: "MOTD 纯文本" },
    { name: "motdHtml", desc: "MOTD HTML" },
    { name: "favicon", desc: "Favicon base64" },
    { name: "faviconHtml", desc: "Favicon HTML 标签" },
    { name: "players", desc: "玩家 JSON 数组" },
    { name: "playersList", desc: "玩家名列表文本" },
    { name: "mods", desc: "Mod JSON 数组" },
    { name: "modsCount", desc: "Mod 数量" },
    { name: "error", desc: "错误信息" },
    { name: "time", desc: "查询时间" },
  ],
  help: [
    { name: "time", desc: "当前时间" },
  ],
  list: [
    { name: "count", desc: "服务器数量" },
    { name: "servers", desc: "服务器行 HTML" },
    { name: "serversJson", desc: "服务器 JSON 数组" },
    { name: "time", desc: "当前时间" },
  ],
}

interface PluginConfig {
  customTemplates?: { status?: string; help?: string; list?: string }
  [key: string]: unknown
}

export default function TemplatePage({ showToast }: { showToast: (msg: string, ok?: boolean) => void }) {
  const [cfg, setCfg] = useState<PluginConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [tplType, setTplType] = useState<TemplateType>("status")
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await apiFetch(`${API}/config`).then(r => r.json())
      if (r.ok) setCfg(r.config)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { load() }, [load])

  const updateTemplate = (type: TemplateType, value: string) => {
    setPreviewHtml(null)
    setCfg((c) => {
      if (!c) return c
      const customTemplates = { ...(c.customTemplates || {}) }
      if (value.trim()) customTemplates[type] = value
      else delete customTemplates[type]
      return { ...c, customTemplates }
    })
  }

  const clearTemplate = () => {
    updateTemplate(tplType, "")
  }

  const previewTemplate = async () => {
    const html = cfg?.customTemplates?.[tplType]?.trim()
    if (!html) {
      showToast("模板为空，无法预览", false)
      return
    }
    try {
      const r = await apiFetch(`${API}/preview-html`, {
        method: "POST",
        body: JSON.stringify({ type: tplType, html }),
      })
      const text = await r.text()
      setPreviewHtml(text)
    } catch {
      showToast("预览生成失败", false)
    }
  }

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

  if (!cfg) return <p className="text-sm text-slate-400 text-center py-12">加载中...</p>

  const currentHtml = cfg.customTemplates?.[tplType] || ""
  const vars = TEMPLATE_VARS[tplType]

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3rem)" }}>
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900">自定义模板</h1>
          <p className="text-sm text-slate-400 mt-0.5">为图片模式编写自定义 HTML 模板，留空则使用内置模板</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="h-10 rounded-xl bg-emerald-600 text-white px-6 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {saving ? "保存中..." : "保存模板"}
        </button>
      </div>

      {/* 可用变量 */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 mb-4 shrink-0">
        <div className="text-[11px] font-semibold text-blue-700 mb-2 uppercase tracking-wider">
          可用变量 — {TEMPLATE_TYPES.find(t => t.value === tplType)?.label}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
          {vars.map((v) => (
            <span key={v.name}>
              <code className="font-mono text-blue-600 font-semibold">{`{{${v.name}}}`}</code>{" "}
              <span className="text-slate-400">{v.desc}</span>
            </span>
          ))}
        </div>
      </div>

      {/* 类型切换 */}
      <div className="flex gap-2 mb-4 shrink-0">
        {TEMPLATE_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => { setTplType(t.value); setPreviewHtml(null) }}
            className={`rounded-xl border px-4 py-2 text-xs font-medium transition-all ${
              tplType === t.value
                ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 左右两栏：编辑 + 预览 */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        {/* 左侧：编辑器 */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">HTML 模板</span>
            <div className="flex gap-1.5">
              <button onClick={clearTemplate} className="h-7 rounded-lg border border-slate-200 px-2.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50 transition-colors">清空</button>
              <button onClick={previewTemplate} className="h-7 rounded-lg border border-slate-200 bg-emerald-600 px-2.5 text-[11px] font-medium text-white hover:bg-emerald-700 transition-colors">预览</button>
            </div>
          </div>
          <textarea
            className="flex-1 w-full p-4 font-mono text-xs leading-6 outline-none resize-none bg-slate-50/30"
            value={currentHtml}
            onChange={(e) => updateTemplate(tplType, e.target.value)}
            placeholder={`留空使用内置模板，输入完整 HTML 文档...\n\n可用变量：\n${vars.map(v => `{{${v.name}}} — ${v.desc}`).join('\n')}\n\n示例：\n<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"></head>\n<body>\n  <div>{{onlineEmoji}} {{address}}</div>\n  <div>玩家: {{playersOnline}}/{{playersMax}}</div>\n</body>\n</html>`}
          />
        </div>

        {/* 右侧：预览 */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 shrink-0">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">预览效果</span>
          </div>
          <div className="flex-1 bg-white min-h-0">
            {previewHtml ? (
              <iframe title="模板预览" className="w-full h-full border-0" srcDoc={previewHtml} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-300">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-16 h-16 mb-3 opacity-40"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <p className="text-sm">点击「预览」查看效果</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
