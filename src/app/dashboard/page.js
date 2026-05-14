'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts'
import {
  FlaskConical, ShoppingCart, Users, Receipt,
  Package, Truck, HandCoins, TrendingUp,
  AlertTriangle, Bell, ArrowRight,
  RefreshCw, Loader2
} from 'lucide-react'
import Link from 'next/link'

const CHART_COLORS = ['#f97316', '#60a5fa', '#4ade80', '#fbbf24', '#a78bfa', '#f472b6']

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
      <div style={{ color: 'var(--text-2)', marginBottom: 6, fontSize: 11 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {p.value?.toLocaleString('en-IN')}
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const [loading, setLoading]               = useState(true)
  const [stats, setStats]                   = useState({})
  const [productionChart, setProductionChart] = useState([])
  const [salesChart, setSalesChart]         = useState([])
  const [expenseChart, setExpenseChart]     = useState([])
  const [productPieData, setProductPieData] = useState([])
  const [lowStock, setLowStock]             = useState([])
  const [notifications, setNotifications]   = useState([])
  const [recentSales, setRecentSales]       = useState([])

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadStats(), loadProductionChart(), loadSalesChart(), loadExpenseChart(), loadProductPie(), loadLowStock(), loadNotifications(), loadRecentSales()])
    setLoading(false)
  }

  async function loadStats() {
    const today = new Date().toISOString().split('T')[0]
    const ms    = today.slice(0, 8) + '01'
    const [{ count: tp }, { count: ts }, { data: te }, { data: ms2 }, { count: ps }] = await Promise.all([
      supabase.from('daily_production').select('*', { count: 'exact', head: true }).eq('entry_date', today),
      supabase.from('daily_sales').select('*', { count: 'exact', head: true }).eq('entry_date', today),
      supabase.from('daily_expenses').select('amount').eq('entry_date', today),
      supabase.from('daily_sale_items').select('total_amount, daily_sales!inner(entry_date)').gte('daily_sales.entry_date', ms).lte('daily_sales.entry_date', today),
      supabase.from('salary_payments').select('*', { count: 'exact', head: true }).in('payment_status', ['pending', 'partial']),
    ])
    setStats({
      todayProduction: tp || 0,
      todaySales:      ts || 0,
      todayExpenses:   (te || []).reduce((s, e) => s + parseFloat(e.amount || 0), 0),
      monthSales:      (ms2 || []).reduce((s, e) => s + parseFloat(e.total_amount || 0), 0),
      pendingSalary:   ps || 0,
    })
  }

  async function loadProductionChart() {
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d.toISOString().split('T')[0] })
    const { data } = await supabase.from('daily_production').select('entry_date, quantity').gte('entry_date', days[0]).lte('entry_date', days[6])
    const m = {}; days.forEach(d => { m[d] = 0 }); (data || []).forEach(r => { m[r.entry_date] = (m[r.entry_date] || 0) + parseFloat(r.quantity || 0) })
    setProductionChart(days.map(d => ({ date: new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), 'Units': Math.round(m[d] || 0) })))
  }

  async function loadSalesChart() {
    const today = new Date().toISOString().split('T')[0]
    const days  = Array.from({ length: 28 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (27 - i)); return d.toISOString().split('T')[0] })
    const { data } = await supabase.from('daily_sales').select('entry_date, daily_sale_items(total_amount)').gte('entry_date', days[0]).lte('entry_date', today)
    const m = {}; days.forEach(d => { m[d] = 0 }); (data || []).forEach(s => { const t = (s.daily_sale_items || []).reduce((a, i) => a + parseFloat(i.total_amount || 0), 0); if (m[s.entry_date] !== undefined) m[s.entry_date] += t })
    const weekly = []; for (let i = 0; i < days.length; i += 7) { const wk = days.slice(i, i + 7); weekly.push({ week: new Date(wk[0]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), '₹ Sales': Math.round(wk.reduce((s, d) => s + (m[d] || 0), 0)) }) }
    setSalesChart(weekly)
  }

  async function loadExpenseChart() {
    const today = new Date().toISOString().split('T')[0], ms = today.slice(0, 8) + '01'
    const { data } = await supabase.from('daily_expenses').select('amount, expense_categories(name)').gte('entry_date', ms).lte('entry_date', today)
    const m = {}; (data || []).forEach(e => { const c = e.expense_categories?.name || 'Other'; m[c] = (m[c] || 0) + parseFloat(e.amount || 0) })
    setExpenseChart(Object.entries(m).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value).slice(0, 6))
  }

  async function loadProductPie() {
    const today = new Date().toISOString().split('T')[0], ms = today.slice(0, 8) + '01'
    const { data } = await supabase.from('daily_production').select('quantity, products(name)').gte('entry_date', ms).lte('entry_date', today)
    const m = {}; (data || []).forEach(r => { const n = r.products?.name || 'Unknown'; m[n] = (m[n] || 0) + parseFloat(r.quantity || 0) })
    setProductPieData(Object.entries(m).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value))
  }

  async function loadLowStock() {
    const { data } = await supabase.from('v_raw_material_stock').select('name, current_stock, unit').eq('is_low_stock', true)
    setLowStock(data || [])
  }

  async function loadNotifications() {
    const { data } = await supabase.from('notifications').select('*').eq('is_read', false).order('created_at', { ascending: false }).limit(5)
    setNotifications(data || [])
  }

  async function loadRecentSales() {
    const { data } = await supabase.from('daily_sales').select('id, entry_date, distributors(name), daily_sale_items(total_amount)').order('entry_date', { ascending: false }).limit(5)
    setRecentSales(data || [])
  }

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">{today}</div>
        </div>
        <button className="btn btn-ghost" onClick={loadAll} disabled={loading}>
          {loading ? <><Loader2 size={14} className="spin" />Loading…</> : <><RefreshCw size={14} />Refresh</>}
        </button>
      </div>

      {lowStock.length > 0 && (
        <div className="alert-banner">
          <AlertTriangle size={15} />
          <span><strong>Low Stock:</strong> {lowStock.map(s => `${s.name} (${parseFloat(s.current_stock).toFixed(1)} ${s.unit})`).join(' · ')}</span>
          <Link href="/dashboard/raw-materials" className="alert-link">View <ArrowRight size={12} /></Link>
        </div>
      )}

      {/* Stat cards */}
      <div className="stat-grid">
        {[
          { label: "Today's Batches",  value: stats.todayProduction || 0,   sub: 'production entries', icon: FlaskConical, color: 'var(--green)',  href: '/dashboard/production' },
          { label: "Today's Bills",    value: stats.todaySales || 0,         sub: 'distributor sales',  icon: ShoppingCart, color: 'var(--blue)',   href: '/dashboard/sales' },
          { label: "Today's Expenses", value: `₹${(stats.todayExpenses||0).toLocaleString('en-IN')}`, sub: 'total spent', icon: Receipt, color: 'var(--brand)', href: '/dashboard/expenses' },
          { label: 'Month Sales',      value: `₹${(stats.monthSales||0).toLocaleString('en-IN')}`, sub: 'billed this month', icon: TrendingUp, color: 'var(--green)', href: '/dashboard/sales/history' },
          { label: 'Pending Salary',   value: stats.pendingSalary || 0,      sub: 'workers unpaid', icon: Users, color: stats.pendingSalary > 0 ? 'var(--yellow)' : 'var(--green)', href: '/dashboard/workers/salary' },
          { label: 'Low Stock',        value: lowStock.length,               sub: 'need reordering', icon: Package, color: lowStock.length > 0 ? 'var(--red)' : 'var(--green)', href: '/dashboard/raw-materials' },
        ].map(s => (
          <Link key={s.label} href={s.href} className="stat-card stat-lnk">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                <div className="stat-sub">{s.sub}</div>
              </div>
              <div style={{ width: 42, height: 42, borderRadius: 'var(--r-md)', background: s.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <s.icon size={18} color={s.color} strokeWidth={1.8} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="ch-row">
        <div className="card">
          <div className="ch-title"><FlaskConical size={14} color="var(--green)" />Production — 7 Days</div>
          {loading ? <div className="ch-ph"><Loader2 size={18} className="spin" /></div> : (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={productionChart} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4ade80" stopOpacity={0.25} /><stop offset="95%" stopColor="#4ade80" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-3)', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Units" stroke="#4ade80" strokeWidth={2} fill="url(#pg)" dot={{ fill: '#4ade80', r: 3, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card">
          <div className="ch-title"><ShoppingCart size={14} color="var(--blue)" />Sales — 4 Weeks</div>
          {loading ? <div className="ch-ph"><Loader2 size={18} className="spin" /></div> : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={salesChart} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="week" tick={{ fill: 'var(--text-3)', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="₹ Sales" fill="#60a5fa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="ch-row" style={{ marginTop: 20 }}>
        <div className="card">
          <div className="ch-title"><Receipt size={14} color="var(--brand)" />Expenses This Month</div>
          {loading ? <div className="ch-ph"><Loader2 size={18} className="spin" /></div> : expenseChart.length === 0 ? <div className="ch-ph">No expense data yet</div> : (
            <div className="pie-wrap">
              <ResponsiveContainer width="50%" height={210}><PieChart><Pie data={expenseChart} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">{expenseChart.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><Tooltip content={<CustomTooltip />} /></PieChart></ResponsiveContainer>
              <div className="pie-leg">{expenseChart.map((item, i) => (<div key={i} className="pie-row"><div className="pie-dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} /><span className="pie-n">{item.name}</span><span className="pie-v">₹{item.value.toLocaleString('en-IN')}</span></div>))}</div>
            </div>
          )}
        </div>
        <div className="card">
          <div className="ch-title"><FlaskConical size={14} color="var(--brand)" />Production Mix</div>
          {loading ? <div className="ch-ph"><Loader2 size={18} className="spin" /></div> : productPieData.length === 0 ? <div className="ch-ph">No production data yet</div> : (
            <div className="pie-wrap">
              <ResponsiveContainer width="50%" height={210}><PieChart><Pie data={productPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">{productPieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><Tooltip content={<CustomTooltip />} /></PieChart></ResponsiveContainer>
              <div className="pie-leg">{productPieData.map((item, i) => (<div key={i} className="pie-row"><div className="pie-dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} /><span className="pie-n">{item.name}</span><span className="pie-v">{item.value.toLocaleString('en-IN')}</span></div>))}</div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="btm-row" style={{ marginTop: 20 }}>
        <div className="card">
          <div className="sh"><div className="ch-title"><ShoppingCart size={14} color="var(--blue)" />Recent Sales</div><Link href="/dashboard/sales/history" className="see-all">See all <ArrowRight size={12} /></Link></div>
          {recentSales.length === 0 ? <div className="empty-state" style={{ padding: '24px 0' }}><ShoppingCart size={24} /><p>No sales yet</p></div> : recentSales.map(s => { const t = (s.daily_sale_items || []).reduce((a, i) => a + parseFloat(i.total_amount || 0), 0); return (<div key={s.id} className="rec-row"><div className="rec-ico"><ShoppingCart size={12} color="var(--blue)" /></div><div style={{ flex: 1 }}><div style={{ fontWeight: 500, fontSize: 13 }}>{s.distributors?.name}</div><div style={{ fontSize: 11, color: 'var(--text-3)' }}>{new Date(s.entry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div></div><span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--green)', fontSize: 14 }}>₹{t.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>) })}
        </div>
        <div className="card">
          <div className="sh"><div className="ch-title"><Bell size={14} color="var(--yellow)" />Alerts</div>{(lowStock.length + notifications.length) > 0 && <span className="badge badge-red">{lowStock.length + notifications.length}</span>}</div>
          {lowStock.length === 0 && notifications.length === 0 ? <div className="empty-state" style={{ padding: '24px 0' }}><Bell size={24} /><p>All clear!</p></div> : <>{lowStock.map(s => (<div key={s.name} className="notif-row notif-warn"><AlertTriangle size={13} color="var(--yellow)" style={{ flexShrink: 0, marginTop: 2 }} /><div><div style={{ fontWeight: 500, fontSize: 13 }}>Low Stock: {s.name}</div><div style={{ fontSize: 11, color: 'var(--text-3)' }}>{parseFloat(s.current_stock).toFixed(2)} {s.unit} left</div></div></div>))}{notifications.map(n => (<div key={n.id} className="notif-row notif-info"><Bell size={13} color="var(--blue)" style={{ flexShrink: 0, marginTop: 2 }} /><div><div style={{ fontWeight: 500, fontSize: 13 }}>{n.title}</div><div style={{ fontSize: 11, color: 'var(--text-3)' }}>{n.message}</div></div></div>))}</>}
        </div>
        <div className="card">
          <div className="sh"><div className="ch-title"><TrendingUp size={14} color="var(--brand)" />Quick Actions</div></div>
          {[
            { label: 'Add Production',  href: '/dashboard/production',          icon: FlaskConical, color: 'var(--green)'  },
            { label: 'Add Sale',        href: '/dashboard/sales',               icon: ShoppingCart, color: 'var(--blue)'   },
            { label: 'Attendance',      href: '/dashboard/workers/attendance',  icon: Users,        color: 'var(--yellow)' },
            { label: 'Add Expense',     href: '/dashboard/expenses',            icon: Receipt,      color: 'var(--brand)'  },
            { label: 'Stock Entry',     href: '/dashboard/raw-materials/entry', icon: Package,      color: 'var(--blue)'   },
            { label: 'Vehicle Expense', href: '/dashboard/vehicles',            icon: Truck,        color: 'var(--text-2)' },
            { label: 'Partner Entry',   href: '/dashboard/partners',            icon: HandCoins,    color: 'var(--green)'  },
          ].map(a => (
            <Link key={a.label} href={a.href} className="qa-item">
              <div className="qa-ico" style={{ background: a.color + '18' }}><a.icon size={14} color={a.color} strokeWidth={1.8} /></div>
              <span>{a.label}</span>
              <ArrowRight size={12} style={{ marginLeft: 'auto', color: 'var(--text-3)' }} />
            </Link>
          ))}
        </div>
      </div>
<style jsx>{`
        .alert-banner { display:flex; align-items:center; gap:10px; background:var(--yellow-dim); border:1px solid rgba(251,191,36,0.3); border-radius:var(--r-md); padding:12px 16px; color:var(--yellow); font-size:13px; margin-bottom:20px; }
        .alert-link { display:flex; align-items:center; gap:4px; margin-left:auto; color:var(--yellow); font-weight:600; text-decoration:none; font-size:12px; white-space:nowrap; }
        .stat-lnk { text-decoration:none; display:block; transition:transform 0.15s, box-shadow 0.15s; }
        .stat-lnk:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.2); }
        .ch-row { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
        .ch-title { display:flex; align-items:center; gap:8px; font-family:var(--font-display); font-weight:700; font-size:14px; margin-bottom:16px; }
        .ch-ph { height:210px; display:flex; align-items:center; justify-content:center; color:var(--text-3); font-size:13px; }
        .pie-wrap { display:flex; align-items:center; }
        .pie-leg { flex:1; display:flex; flex-direction:column; gap:8px; padding-left:8px; }
        .pie-row { display:flex; align-items:center; gap:7px; }
        .pie-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .pie-n { flex:1; font-size:12px; color:var(--text-2); }
        .pie-v { font-size:12px; font-weight:600; color:var(--text); }
        .btm-row { display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px; }
        .sh { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; padding-bottom:12px; border-bottom:1px solid var(--border); }
        .see-all { display:flex; align-items:center; gap:4px; font-size:12px; color:var(--brand); text-decoration:none; }
        .rec-row { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
        .rec-ico { width:28px; height:28px; border-radius:var(--r-sm); background:var(--blue-dim); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .notif-row { display:flex; align-items:flex-start; gap:10px; padding:9px 12px; border-radius:var(--r-sm); border:1px solid; margin-bottom:8px; }
        .notif-warn { background:var(--yellow-dim); border-color:rgba(251,191,36,0.2); }
        .notif-info { background:var(--blue-dim); border-color:rgba(96,165,250,0.2); }
        .qa-item { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:var(--r-sm); text-decoration:none; color:var(--text-2); font-size:13px; transition:all 0.14s; }
        .qa-item:hover { background:var(--surface-2); color:var(--text); }
        .qa-ico { width:28px; height:28px; border-radius:var(--r-sm); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        :global(.spin) { animation:spin 0.7s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }
        @media (max-width:1100px) { .ch-row { grid-template-columns:1fr; } .btm-row { grid-template-columns:1fr 1fr; } }
        @media (max-width:700px)  { .btm-row { grid-template-columns:1fr; } }
      `}</style>
    </div>
  )
}
