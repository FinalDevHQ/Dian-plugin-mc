import { useState } from "react"
import Dashboard from "./pages/Dashboard"
import ConfigPage from "./pages/Config"
import ServersPage from "./pages/Servers"
import HistoryPage from "./pages/History"

type Page = "dashboard" | "servers" | "config" | "history"

const NAV: { id: Page; label: string; icon: React.JSX.Element }[] = [
  { id: "dashboard", label: "仪表盘", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg> },
  { id: "servers", label: "服务器列表", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1"/><circle cx="6" cy="18" r="1"/></svg> },
  { id: "config", label: "插件配置", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg> },
  { id: "history", label: "查询历史", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><circle cx="12" cy="12" r="9"/><polyline points="12,7 12,12 15,15"/></svg> },
]

export default function App() {
  const [page, setPage] = useState<Page>("dashboard")
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  const pages: Record<Page, React.ReactNode> = {
    dashboard: <Dashboard />,
    servers: <ServersPage showToast={showToast} />,
    config: <ConfigPage showToast={showToast} />,
    history: <HistoryPage />,
  }

  return (
    <div className="flex h-screen bg-[#f8fafc]">
      {/* 侧边栏 */}
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-800 text-white text-sm shadow-sm">
              🎮
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">MC 查询</div>
              <div className="text-[10px] text-slate-400">服务器状态查询</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setPage(n.id)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all text-left ${
                page === n.id
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              }`}
            >
              {n.icon}
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-slate-100">
          <div className="text-[10px] text-slate-400 text-center">Dian Plugin System</div>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-y-auto">
        <div className="px-10 py-6">
          {pages[page]}
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-lg ${
          toast.ok
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-red-200 bg-red-50 text-red-700"
        }`}>
          {toast.ok ? "✓" : "✗"} {toast.msg}
        </div>
      )}
    </div>
  )
}
