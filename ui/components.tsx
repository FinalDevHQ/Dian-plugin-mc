import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react"

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,.04),0_6px_16px_rgba(0,0,0,.04)] ${className}`}>{children}</div>
}

export function CardHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-1 px-6 pt-5 pb-3 ${className}`}>{children}</div>
}

export function CardContent({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-6 pb-6 ${className}`}>{children}</div>
}

export function Label({ children, htmlFor, className = "" }: { children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={`text-sm font-semibold text-slate-900 ${className}`}>
      {children}
    </label>
  )
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  )
}

type ButtonVariant = "default" | "secondary" | "ghost"
export function Button({
  variant = "default",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const variants: Record<ButtonVariant, string> = {
    default:   "bg-slate-900 text-white hover:bg-slate-800 shadow-sm",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    ghost:     "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  }
  return (
    <button
      {...props}
      className={`inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${className}`}
    />
  )
}

export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${className}`}>
      {children}
    </span>
  )
}

export function StatCard({ label, value, mono = false, icon }: {
  label: string; value: string | number; mono?: boolean; icon?: React.JSX.Element
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,.04),0_6px_16px_rgba(0,0,0,.04)] hover:shadow-[0_2px_6px_rgba(0,0,0,.06),0_8px_24px_rgba(0,0,0,.06)] transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
          <p className={`text-2xl font-bold text-slate-900 mt-2 tabular-nums ${mono ? "font-mono" : ""}`}>
            {value}
          </p>
        </div>
        {icon && (
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-sm">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}

export function RegSection({ title, count, empty, children }: {
  title: string; count: number; empty: string; children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">{title}</span>
        <span className="text-[10px] tabular-nums text-slate-400">{count}</span>
      </div>
      {count === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-4 text-center text-[11px] text-slate-400">
          {empty}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">{children}</div>
      )}
    </div>
  )
}

export function MethodBadge({ method }: { method: string }) {
  const cls: Record<string, string> = {
    GET:    "border-emerald-200 bg-emerald-50 text-emerald-700",
    POST:   "border-blue-200 bg-blue-50 text-blue-700",
    PUT:    "border-amber-200 bg-amber-50 text-amber-700",
    PATCH:  "border-violet-200 bg-violet-50 text-violet-700",
    DELETE: "border-red-200 bg-red-50 text-red-700",
  }
  return (
    <Badge className={`shrink-0 font-mono ${cls[method] ?? ""}`}>
      {method}
    </Badge>
  )
}
