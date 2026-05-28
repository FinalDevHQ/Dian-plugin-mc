import { useState } from "react"
import { Card } from "../components"

interface Command {
  cmd: string
  aliases?: string[]
  desc: string
  usage: string
  examples: string[]
  note?: string
}

interface Category {
  id: string
  label: string
  color: string
  icon: React.ReactNode
  commands: Command[]
}

const CATEGORIES: Category[] = [
  {
    id: "query",
    label: "查询",
    color: "emerald",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 3.5 3.5" />
      </svg>
    ),
    commands: [
      {
        cmd: "mc 查询",
        aliases: ["mc ping", "mc status", "mc info"],
        desc: "查询指定服务器的实时状态，包含在线人数、版本、延迟、MOTD。",
        usage: "mc 查询 <地址[:端口]>",
        examples: ["mc 查询 mc.hypixel.net", "mc 状态 play.cubecraft.net:25565", "mc 查询 海岛"],
        note: "可以直接输入已保存的服务器名称，插件会自动解析为对应地址。"
      },
      {
        cmd: "mc 全部",
        aliases: ["mc all", "mc 批量"],
        desc: "批量查询所有已保存服务器的状态，一次性获得概览。",
        usage: "mc 全部",
        examples: ["mc 全部", "mc all"],
      },
    ],
  },
  {
    id: "manage",
    label: "管理",
    color: "blue",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" />
        <circle cx="6" cy="6" r="1" /><circle cx="6" cy="18" r="1" />
      </svg>
    ),
    commands: [
      {
        cmd: "mc 列表",
        aliases: ["mc list", "mc ls"],
        desc: "查看当前已保存的所有服务器，显示名称、地址和实时延迟。",
        usage: "mc 列表",
        examples: ["mc 列表", "mc list"],
      },
      {
        cmd: "mc 添加",
        aliases: ["mc add", "mc 订阅"],
        desc: "将服务器添加到列表，之后可以用名称快速查询。",
        usage: "mc 添加 <名称> <地址[:端口]>",
        examples: ["mc 添加 海岛 mc.hypixel.net", "mc 添加 本地 127.0.0.1:25565"],
        note: "名称和地址不可与已有服务器重复。"
      },
      {
        cmd: "mc 删除",
        aliases: ["mc del", "mc remove", "mc 取消"],
        desc: "从列表中移除指定服务器。",
        usage: "mc 删除 <名称或地址>",
        examples: ["mc 删除 海岛", "mc remove mc.hypixel.net"],
      },
      {
        cmd: "mc 编辑",
        aliases: ["mc edit", "mc 修改"],
        desc: "修改已保存服务器的名称或地址。新名称和新地址均为可选，至少提供一个。",
        usage: "mc 编辑 <名称> [新名称] [新地址]",
        examples: [
          "mc 编辑 海岛 新名称",
          "mc 编辑 海岛 新名称 mc.new.net",
          "mc 编辑 海岛 _ mc.new.net",
        ],
      },
    ],
  },
  {
    id: "help",
    label: "帮助",
    color: "violet",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><circle cx="12" cy="17" r=".5" fill="currentColor" />
      </svg>
    ),
    commands: [
      {
        cmd: "mc 帮助",
        aliases: ["mc help", "mc 命令"],
        desc: "在聊天窗口内显示所有可用指令的快速参考。",
        usage: "mc 帮助",
        examples: ["mc 帮助", "mc help"],
      },
    ],
  },
]

const COLOR_MAP = {
  emerald: {
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: "bg-emerald-50 text-emerald-600",
    dot: "bg-emerald-500",
    alias: "bg-emerald-50 text-emerald-600 border-emerald-100",
  },
  blue: {
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    icon: "bg-blue-50 text-blue-600",
    dot: "bg-blue-500",
    alias: "bg-blue-50 text-blue-600 border-blue-100",
  },
  violet: {
    badge: "bg-violet-50 text-violet-700 border-violet-200",
    icon: "bg-violet-50 text-violet-600",
    dot: "bg-violet-500",
    alias: "bg-violet-50 text-violet-600 border-violet-100",
  },
} as const

type ColorKey = keyof typeof COLOR_MAP

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button
      onClick={handleCopy}
      title="复制"
      className="ml-auto shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 active:scale-95"
    >
      {copied ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-emerald-500">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  )
}

function CodeLine({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2.5 font-mono text-sm group">
      <span className="select-none text-slate-500">$</span>
      <span className="text-slate-100 flex-1 truncate">{text}</span>
      <CopyButton text={text} />
    </div>
  )
}

function CommandCard({ cmd, color }: { cmd: Command; color: ColorKey }) {
  const c = COLOR_MAP[color]
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,.04)]">
      {/* Header */}
      <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-bold font-mono ${c.badge}`}>
              {cmd.cmd}
            </span>
            {cmd.aliases?.map(a => (
              <span key={a} className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-mono ${c.alias}`}>
                {a}
              </span>
            ))}
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{cmd.desc}</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 flex flex-col gap-3">
        {/* Usage */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">用法</p>
          <CodeLine text={cmd.usage} />
        </div>

        {/* Examples */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">示例</p>
          <div className="flex flex-col gap-1.5">
            {cmd.examples.map((ex, i) => (
              <CodeLine key={i} text={ex} />
            ))}
          </div>
        </div>

        {/* Note */}
        {cmd.note && (
          <div className="flex gap-2.5 rounded-lg bg-amber-50 border border-amber-100 px-3.5 py-2.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-amber-500 shrink-0 mt-0.5">
              <path d="M12 9v4M12 17h.01" /><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-xs text-amber-700 leading-relaxed">{cmd.note}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function AddressGuide() {
  const formats = [
    { input: "mc.hypixel.net", result: "mc.hypixel.net:25565", note: "省略端口时使用默认 25565" },
    { input: "play.example.com:25566", result: "play.example.com:25566", note: "指定自定义端口" },
    { input: "海岛", result: "查找已保存名称", note: "以保存的名称代替地址" },
  ]
  return (
    <Card>
      <div className="px-6 pt-5 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-0.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-slate-400">
            <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
          </svg>
          <span className="text-sm font-semibold text-slate-900">地址格式</span>
        </div>
        <p className="text-xs text-slate-400">支持的输入方式</p>
      </div>
      <div className="px-6 pb-5 pt-4">
        <div className="flex flex-col gap-2">
          {formats.map((f, i) => (
            <div key={i} className="grid grid-cols-[auto_24px_auto_1fr] items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <code className="text-sm font-mono text-slate-800 bg-white border border-slate-200 rounded-md px-2 py-0.5 whitespace-nowrap">{f.input}</code>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-slate-300 shrink-0">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              <code className="text-sm font-mono text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-2 py-0.5 whitespace-nowrap">{f.result}</code>
              <span className="text-xs text-slate-400 pl-1">{f.note}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

export default function GuidePage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const filtered = activeCategory
    ? CATEGORIES.filter(c => c.id === activeCategory)
    : CATEGORIES

  const totalCmds = CATEGORIES.reduce((s, c) => s + c.commands.length, 0)

  return (
    <div className="flex flex-col gap-6">
      {/* 页头 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">指令指南</h1>
          <p className="text-sm text-slate-400 mt-0.5">共 {totalCmds} 条指令 · 在聊天框中直接输入使用</p>
        </div>
        {/* 前缀提示 */}
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
          <span className="text-xs text-slate-400">触发前缀</span>
          <code className="font-mono text-sm font-bold text-slate-800 bg-white border border-slate-200 rounded-md px-2 py-0.5">mc</code>
          <span className="text-xs text-slate-300">|</span>
          <code className="font-mono text-sm font-bold text-slate-800 bg-white border border-slate-200 rounded-md px-2 py-0.5">minecraft</code>
        </div>
      </div>

      {/* 分类过滤器 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-all ${
            activeCategory === null
              ? "border-slate-800 bg-slate-900 text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          全部
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${activeCategory === null ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
            {totalCmds}
          </span>
        </button>
        {CATEGORIES.map(cat => {
          const c = COLOR_MAP[cat.color as ColorKey]
          const active = activeCategory === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(active ? null : cat.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-all ${
                active
                  ? `${c.badge} shadow-sm`
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {cat.icon}
              {cat.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${active ? "bg-white/60" : "bg-slate-100 text-slate-500"}`}>
                {cat.commands.length}
              </span>
            </button>
          )
        })}
      </div>

      {/* 地址格式说明 */}
      {!activeCategory && <AddressGuide />}

      {/* 指令列表 */}
      {filtered.map(cat => {
        const c = COLOR_MAP[cat.color as ColorKey]
        return (
          <div key={cat.id} className="flex flex-col gap-3">
            {/* 分类标题 */}
            <div className="flex items-center gap-2.5">
              <div className={`flex items-center justify-center w-7 h-7 rounded-lg ${c.icon}`}>
                {cat.icon}
              </div>
              <span className="text-sm font-semibold text-slate-700">{cat.label}</span>
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-[11px] text-slate-400 tabular-nums">{cat.commands.length} 条指令</span>
            </div>

            {/* 指令卡片网格 */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {cat.commands.map((cmd, i) => (
                <CommandCard key={i} cmd={cmd} color={cat.color as ColorKey} />
              ))}
            </div>
          </div>
        )
      })}

      {/* 底部提示 */}
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 px-5 py-4 text-sm text-slate-400">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 shrink-0 text-slate-300">
          <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
        </svg>
        所有指令均支持中英文别名混用，例如 <code className="text-slate-600 bg-slate-100 rounded px-1 py-0.5 font-mono text-xs">mc ping</code>、
        <code className="text-slate-600 bg-slate-100 rounded px-1 py-0.5 font-mono text-xs">mc 查询</code> 效果相同。
      </div>
    </div>
  )
}
