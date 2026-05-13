import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import {
  FlaskConical, ShoppingCart, Users,
  Receipt, Package, TrendingUp
} from 'lucide-react'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  const today = new Date().toISOString().split('T')[0]

  const [
    { count: productionCount },
    { count: salesCount },
    { count: expenseCount },
    { data: lowStock },
  ] = await Promise.all([
    supabase.from('daily_production').select('*', { count: 'exact', head: true }).eq('entry_date', today),
    supabase.from('daily_sales').select('*', { count: 'exact', head: true }).eq('entry_date', today),
    supabase.from('daily_expenses').select('*', { count: 'exact', head: true }).eq('entry_date', today),
    supabase.from('v_raw_material_stock').select('name').eq('is_low_stock', true),
  ])

  const stats = [
    {
      label: "Today's Production",
      value: productionCount || 0,
      sub: 'batches entered today',
      icon: FlaskConical,
      color: 'var(--green)',
    },
    {
      label: "Today's Sales",
      value: salesCount || 0,
      sub: 'distributor bills today',
      icon: ShoppingCart,
      color: 'var(--blue)',
    },
    {
      label: "Today's Expenses",
      value: expenseCount || 0,
      sub: 'expense entries today',
      icon: Receipt,
      color: 'var(--brand)',
    },
    {
      label: 'Low Stock Alerts',
      value: lowStock?.length || 0,
      sub: lowStock?.length ? lowStock.map(s => s.name).join(', ') : 'All materials stocked',
      icon: Package,
      color: lowStock?.length ? 'var(--red)' : 'var(--green)',
    },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        {stats.map(s => (
          <div key={s.label} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                <div className="stat-sub">{s.sub}</div>
              </div>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--r-md)',
                background: `color-mix(in srgb, ${s.color} 12%, transparent)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <s.icon size={18} color={s.color} strokeWidth={1.8} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <div className="page-title" style={{ fontSize: 16 }}>Quick Actions</div>
          <div className="page-subtitle">Most used entries for today</div>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Add Production', href: '/dashboard/production', icon: FlaskConical, color: 'var(--green)' },
            { label: 'Add Sale', href: '/dashboard/sales', icon: ShoppingCart, color: 'var(--blue)' },
            { label: 'Mark Attendance', href: '/dashboard/workers/attendance', icon: Users, color: 'var(--purple, #a78bfa)' },
            { label: 'Add Expense', href: '/dashboard/expenses', icon: Receipt, color: 'var(--brand)' },
            { label: 'Stock Entry', href: '/dashboard/raw-materials/entry', icon: Package, color: 'var(--yellow)' },
          ].map(a => (
            <a key={a.label} href={a.href} className="quick-action-btn">
              <a.icon size={16} color={a.color} strokeWidth={1.8} />
              {a.label}
            </a>
          ))}
        </div>
      </div>

      {/* Low stock warning */}
      {lowStock && lowStock.length > 0 && (
        <div className="low-stock-banner">
          <Package size={16} />
          <strong>Low Stock Warning:</strong>
          {lowStock.map(s => s.name).join(', ')} — please reorder soon.
        </div>
      )}

      {/* FIXED STYLE (no styled-jsx) */}
      <style>{`
        .quick-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          font-size: 13.5px;
          font-weight: 500;
          color: var(--text);
          text-decoration: none;
          transition: all 0.15s;
          cursor: pointer;
        }

        .quick-action-btn:hover {
          background: var(--surface-3);
          border-color: var(--border-2);
          transform: translateY(-1px);
        }

        .low-stock-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--red-dim);
          border: 1px solid rgba(248,113,113,0.25);
          border-radius: var(--r-md);
          padding: 14px 18px;
          color: var(--red);
          font-size: 13px;
        }
      `}</style>
    </div>
  )
}