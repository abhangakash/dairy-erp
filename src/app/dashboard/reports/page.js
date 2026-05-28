'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  FileBarChart2, Calendar, Search, Download,
  Loader2, FlaskConical, ShoppingCart, Users,
  Receipt, Package, Truck, HandCoins,
  TrendingUp, TrendingDown, ChevronDown,
  ChevronRight, BarChart3, AlertTriangle,
  IndianRupee
} from 'lucide-react'

const REPORT_TYPES = [
  { value: 'overall',      label: 'Overall Summary',      icon: BarChart3    },
  { value: 'pnl',          label: 'Profit & Loss',        icon: TrendingUp   },
  { value: 'production',   label: 'Production',           icon: FlaskConical },
  { value: 'sales',        label: 'Sales (Billed)',       icon: ShoppingCart },
  { value: 'payments',     label: 'Payments Collected',   icon: IndianRupee  },
  { value: 'workers',      label: 'Worker Attendance',    icon: Users        },
  { value: 'salary',       label: 'Salary Payments',      icon: Users        },
  { value: 'expenses',     label: 'Daily Expenses',       icon: Receipt      },
  { value: 'raw_material', label: 'Raw Materials',        icon: Package      },
  { value: 'vehicles',     label: 'Vehicle Expenses',     icon: Truck        },
  { value: 'partners',     label: 'Partner Transactions', icon: HandCoins    },
]

const fmt     = n => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
const fmtDate = d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export default function ReportsPage() {
  const today      = new Date().toISOString().split('T')[0]
  const monthStart = today.slice(0, 8) + '01'

  const [fromDate, setFromDate]     = useState(monthStart)
  const [toDate, setToDate]         = useState(today)
  const [reportType, setReportType] = useState('overall')
  const [loading, setLoading]       = useState(false)
  const [rows, setRows]             = useState(null)
  const [summary, setSummary]       = useState(null)
  const [expanded, setExpanded]     = useState({})

  async function generate() {
    setLoading(true)
    setRows(null)
    setSummary(null)
    setExpanded({})
    try {
      if (reportType === 'overall' || reportType === 'pnl') {
        await fetchSummaryReport()
      } else {
        await fetchDetailReport()
      }
    } catch (err) {
      toast.error('Error: ' + (err.message || 'Unknown'))
    }
    setLoading(false)
  }

  // ── SUMMARY REPORT (Overall + P&L) ───────────────────
  async function fetchSummaryReport() {
    const [
      paymentsResult,   // CASH ACTUALLY COLLECTED ← real income
      billedResult,     // billed (for reference)
      expResult,
      salaryResult,
      vehicleResult,
      rawMatResult,
      productionResult,
      attendanceResult,
    ] = await Promise.all([
      // Cash actually received from distributors in period
      supabase.from('distributor_payments')
        .select('amount, payment_mode, distributor_id, distributors(name)')
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate),

      // Total billed in period (for reference / reconciliation)
      supabase.from('daily_sale_items')
        .select('total_amount, products(name), daily_sales!inner(entry_date, distributor_id, distributors(name))')
        .gte('daily_sales.entry_date', fromDate)
        .lte('daily_sales.entry_date', toDate),

      supabase.from('daily_expenses')
        .select('amount, expense_categories(name)')
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate),

      supabase.from('salary_payments')
        .select('paid_amount')
        .gte('entered_at', fromDate + 'T00:00:00')
        .lte('entered_at', toDate + 'T23:59:59'),

      supabase.from('vehicle_expenses')
        .select('total_amount, expense_type')
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate),

      supabase.from('raw_material_stock_entries')
        .select('quantity, unit_price')
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate),

      supabase.from('daily_production')
        .select('quantity, products(name, unit)')
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate),

      supabase.from('worker_attendance')
        .select('status')
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate),
    ])

    // ── INCOME (cash collected) ──
    const payments        = paymentsResult.data || []
    const totalCollected  = payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0)
    const collectedByDist = {}
    const collectedByMode = {}
    payments.forEach(p => {
      const n = p.distributors?.name || 'Unknown'
      const m = p.payment_mode || 'cash'
      collectedByDist[n] = (collectedByDist[n] || 0) + parseFloat(p.amount || 0)
      collectedByMode[m] = (collectedByMode[m] || 0) + parseFloat(p.amount || 0)
    })

    // ── BILLED (for reference) ──
    const billed       = billedResult.data || []
    const totalBilled  = billed.reduce((s, i) => s + parseFloat(i.total_amount || 0), 0)
    const billedByProd = {}
    billed.forEach(i => {
      const n = i.products?.name || 'Unknown'
      billedByProd[n] = (billedByProd[n] || 0) + parseFloat(i.total_amount || 0)
    })

    const uncollected = Math.max(0, totalBilled - totalCollected)

    // ── EXPENSES ──
    const expItems      = expResult.data || []
    const totalDailyExp = expItems.reduce((s, i) => s + parseFloat(i.amount || 0), 0)
    const expByCategory = {}
    expItems.forEach(i => {
      const c = i.expense_categories?.name || 'Other'
      expByCategory[c] = (expByCategory[c] || 0) + parseFloat(i.amount || 0)
    })

    const totalSalary  = (salaryResult.data || []).reduce((s, r) => s + parseFloat(r.paid_amount || 0), 0)

    const vehicleItems = vehicleResult.data || []
    const totalVehicle = vehicleItems.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0)
    const vehicleByType = {}
    vehicleItems.forEach(r => {
      vehicleByType[r.expense_type] = (vehicleByType[r.expense_type] || 0) + parseFloat(r.total_amount || 0)
    })

    const totalRawMat = (rawMatResult.data || []).reduce((s, r) =>
      s + parseFloat(r.quantity || 0) * parseFloat(r.unit_price || 0), 0)

    const totalExpenses = totalDailyExp + totalSalary + totalVehicle + totalRawMat
    // P&L based on CASH COLLECTED (realistic)
    const netProfit     = totalCollected - totalExpenses
    const margin        = totalCollected > 0 ? ((netProfit / totalCollected) * 100).toFixed(1) : '0.0'

    // ── PRODUCTION ──
    const prodItems    = productionResult.data || []
    const totalProdQty = prodItems.reduce((s, r) => s + parseFloat(r.quantity || 0), 0)
    const prodByProduct = {}
    prodItems.forEach(r => {
      const n = r.products?.name || 'Unknown'
      if (!prodByProduct[n]) prodByProduct[n] = { qty: 0, unit: r.products?.unit || '' }
      prodByProduct[n].qty += parseFloat(r.quantity || 0)
    })

    // ── ATTENDANCE ──
    const attItems   = attendanceResult.data || []
    const attPresent = attItems.filter(a => a.status === 'present').length
    const attAbsent  = attItems.filter(a => a.status === 'absent').length
    const attHalfDay = attItems.filter(a => a.status === 'half_day').length

    setSummary({
      // Cash flow (real income)
      totalCollected, collectedByDist, collectedByMode,
      // Billed (reference)
      totalBilled, billedByProd, uncollected,
      // Expenses
      totalDailyExp, expByCategory,
      totalSalary, totalVehicle, vehicleByType,
      totalRawMat, totalExpenses,
      // P&L
      netProfit, margin,
      // Production
      totalProdQty, prodByProduct,
      // Attendance
      attPresent, attAbsent, attHalfDay, attTotal: attItems.length,
    })
    toast.success('Report generated')
  }

  // ── DETAIL REPORTS ────────────────────────────────────
  async function fetchDetailReport() {
    let result = []

    if (reportType === 'production') {
      const { data: prod, error } = await supabase
        .from('daily_production')
        .select('id, product_id, entry_date, batch_no, quantity, notes, entered_at')
        .gte('entry_date', fromDate).lte('entry_date', toDate)
        .order('entry_date', { ascending: false })
      if (error) throw error
      if (!prod?.length) { setRows([]); toast('No records', { icon: '📭' }); return }
      const pids = [...new Set(prod.map(r => r.product_id).filter(Boolean))]
      const { data: products } = await supabase.from('products').select('id, name, unit, category').in('id', pids)
      const pmap = {}; (products || []).forEach(p => { pmap[p.id] = p })
      result = prod.map(r => ({ ...r, product: pmap[r.product_id] || null }))
    }

    else if (reportType === 'sales') {
      const { data: sales, error } = await supabase
        .from('daily_sales')
        .select('id, entry_date, bill_sent, entered_at, notes, distributor_id')
        .gte('entry_date', fromDate).lte('entry_date', toDate)
        .order('entry_date', { ascending: false })
      if (error) throw error
      if (!sales?.length) { setRows([]); toast('No records', { icon: '📭' }); return }
      const sids = sales.map(s => s.id)
      const dids = [...new Set(sales.map(s => s.distributor_id).filter(Boolean))]
      const [{ data: items }, { data: dists }] = await Promise.all([
        supabase.from('daily_sale_items').select('id, sale_id, product_id, quantity, unit_price, total_amount, products(name, unit)').in('sale_id', sids),
        supabase.from('distributors').select('id, name, phone, route').in('id', dids),
      ])
      const dmap = {}; (dists || []).forEach(d => { dmap[d.id] = d })
      const imap = {}; (items || []).forEach(i => { if (!imap[i.sale_id]) imap[i.sale_id] = []; imap[i.sale_id].push(i) })
      result = sales.map(s => ({ ...s, distributor: dmap[s.distributor_id] || null, items: imap[s.id] || [] }))
    }

    else if (reportType === 'payments') {
      const { data: pays, error } = await supabase
        .from('distributor_payments')
        .select('id, entry_date, amount, payment_mode, notes, reference_no, distributor_id, entered_at')
        .gte('entry_date', fromDate).lte('entry_date', toDate)
        .order('entry_date', { ascending: false })
      if (error) throw error
      if (!pays?.length) { setRows([]); toast('No payment records', { icon: '📭' }); return }
      const dids = [...new Set(pays.map(p => p.distributor_id).filter(Boolean))]
      const { data: dists } = await supabase.from('distributors').select('id, name').in('id', dids)
      const dmap = {}; (dists || []).forEach(d => { dmap[d.id] = d })
      result = pays.map(p => ({ ...p, distributor: dmap[p.distributor_id] || null }))
    }

    else if (reportType === 'workers') {
      const { data, error } = await supabase
        .from('worker_attendance')
        .select('id, entry_date, status, notes, entered_at, worker_id')
        .gte('entry_date', fromDate).lte('entry_date', toDate)
        .order('entry_date', { ascending: false })
      if (error) throw error
      if (!data?.length) { setRows([]); toast('No records', { icon: '📭' }); return }
      const wids = [...new Set(data.map(r => r.worker_id).filter(Boolean))]
      const { data: workers } = await supabase.from('workers').select('id, name, role').in('id', wids)
      const wmap = {}; (workers || []).forEach(w => { wmap[w.id] = w })
      result = data.map(r => ({ ...r, worker: wmap[r.worker_id] || null }))
    }

    else if (reportType === 'salary') {
      const { data, error } = await supabase
        .from('salary_payments')
        .select('id, month, working_days, gross_amount, paid_amount, remaining, payment_status, paid_date, entered_at, worker_id')
        .order('month', { ascending: false })
      if (error) throw error
      if (!data?.length) { setRows([]); toast('No records', { icon: '📭' }); return }
      const wids = [...new Set(data.map(r => r.worker_id).filter(Boolean))]
      const { data: workers } = await supabase.from('workers').select('id, name, role, salary_type').in('id', wids)
      const wmap = {}; (workers || []).forEach(w => { wmap[w.id] = w })
      result = data.map(r => ({ ...r, worker: wmap[r.worker_id] || null }))
    }

    else if (reportType === 'expenses') {
      const { data, error } = await supabase
        .from('daily_expenses')
        .select('id, entry_date, amount, notes, entered_at, category_id')
        .gte('entry_date', fromDate).lte('entry_date', toDate)
        .order('entry_date', { ascending: false })
      if (error) throw error
      if (!data?.length) { setRows([]); toast('No records', { icon: '📭' }); return }
      const catIds = [...new Set(data.map(r => r.category_id).filter(Boolean))]
      const { data: cats } = catIds.length > 0
        ? await supabase.from('expense_categories').select('id, name').in('id', catIds)
        : { data: [] }
      const cmap = {}; (cats || []).forEach(c => { cmap[c.id] = c })
      result = data.map(r => ({ ...r, category: r.category_id ? cmap[r.category_id] : null }))
    }

    else if (reportType === 'raw_material') {
      const { data, error } = await supabase
        .from('raw_material_stock_entries')
        .select('id, entry_date, quantity, unit_price, supplier, entered_at, raw_material_id')
        .gte('entry_date', fromDate).lte('entry_date', toDate)
        .order('entry_date', { ascending: false })
      if (error) throw error
      if (!data?.length) { setRows([]); toast('No records', { icon: '📭' }); return }
      const rmIds = [...new Set(data.map(r => r.raw_material_id).filter(Boolean))]
      const { data: rms } = await supabase.from('raw_materials').select('id, name, unit').in('id', rmIds)
      const rmmap = {}; (rms || []).forEach(r => { rmmap[r.id] = r })
      result = data.map(r => ({ ...r, raw_material: rmmap[r.raw_material_id] || null }))
    }

    else if (reportType === 'vehicles') {
      const { data, error } = await supabase
        .from('vehicle_expenses')
        .select('id, entry_date, expense_type, distance_km, rate_per_km, auto_amount, manual_amount, total_amount, notes, entered_at, vehicle_id, distributor_id')
        .gte('entry_date', fromDate).lte('entry_date', toDate)
        .order('entry_date', { ascending: false })
      if (error) throw error
      if (!data?.length) { setRows([]); toast('No records', { icon: '📭' }); return }
      const vids = [...new Set(data.map(r => r.vehicle_id).filter(Boolean))]
      const dids = [...new Set(data.map(r => r.distributor_id).filter(Boolean))]
      const [{ data: vehs }, { data: dists }] = await Promise.all([
        vids.length > 0 ? supabase.from('vehicles').select('id, name').in('id', vids) : { data: [] },
        dids.length > 0 ? supabase.from('distributors').select('id, name').in('id', dids) : { data: [] },
      ])
      const vmap = {}; (vehs || []).forEach(v => { vmap[v.id] = v })
      const dmap = {}; (dists || []).forEach(d => { dmap[d.id] = d })
      result = data.map(r => ({ ...r, vehicle: vmap[r.vehicle_id] || null, distributor: dmap[r.distributor_id] || null }))
    }

    else if (reportType === 'partners') {
      const { data, error } = await supabase
        .from('partner_transactions')
        .select('id, entry_date, transaction_type, amount, purpose, notes, entered_at, partner_id')
        .gte('entry_date', fromDate).lte('entry_date', toDate)
        .order('entry_date', { ascending: false })
      if (error) throw error
      if (!data?.length) { setRows([]); toast('No records', { icon: '📭' }); return }
      const pids = [...new Set(data.map(r => r.partner_id).filter(Boolean))]
      const { data: partners } = await supabase.from('partners').select('id, name').in('id', pids)
      const pmap = {}; (partners || []).forEach(p => { pmap[p.id] = p })
      result = data.map(r => ({ ...r, partner: pmap[r.partner_id] || null }))
    }

    setRows(result)
    toast.success(`${result.length} records loaded`)
  }

  // ── CSV export ────────────────────────────────────────
  function exportCSV() {
    let csvRows = []

    if ((reportType === 'overall' || reportType === 'pnl') && summary) {
      csvRows = [
        ['MILKYFEAST — P&L REPORT', `${fromDate} to ${toDate}`],
        ['NOTE: Income = Cash Actually Collected from Distributors (NOT billed amount)'],
        [],
        ['INCOME (CASH COLLECTED)'],
        ['Total Cash Collected', summary.totalCollected.toFixed(2)],
        ['Total Billed (reference)', summary.totalBilled.toFixed(2)],
        ['Still Uncollected', summary.uncollected.toFixed(2)],
        [],
        ['Collected by Distributor'],
        ...Object.entries(summary.collectedByDist).map(([n, v]) => [n, v.toFixed(2)]),
        [],
        ['Collected by Payment Mode'],
        ...Object.entries(summary.collectedByMode).map(([n, v]) => [n, v.toFixed(2)]),
        [],
        ['EXPENSES'],
        ['Daily Expenses', summary.totalDailyExp.toFixed(2)],
        ...Object.entries(summary.expByCategory).map(([n, v]) => [`  ${n}`, v.toFixed(2)]),
        ['Salary Paid', summary.totalSalary.toFixed(2)],
        ['Vehicle Expenses', summary.totalVehicle.toFixed(2)],
        ['Raw Material Cost', summary.totalRawMat.toFixed(2)],
        ['Total Expenses', summary.totalExpenses.toFixed(2)],
        [],
        ['NET PROFIT / LOSS (Cash Basis)', summary.netProfit.toFixed(2)],
        ['Profit Margin %', summary.margin + '%'],
      ]
    } else if (rows?.length > 0) {
      if (reportType === 'payments') {
        csvRows = [['Date','Distributor','Amount','Mode','Reference','Notes'],
          ...rows.map(r => [r.entry_date, r.distributor?.name||'', r.amount, r.payment_mode, r.reference_no||'', r.notes||''])]
      } else if (reportType === 'production') {
        csvRows = [['Date','Product','Category','Batch','Quantity','Unit'],
          ...rows.map(r => [r.entry_date, r.product?.name||'', r.product?.category||'', r.batch_no, r.quantity, r.product?.unit||''])]
      } else if (reportType === 'sales') {
        csvRows = [['Date','Distributor','Product','Qty','Unit Price','Total','Bill Sent']]
        rows.forEach(s => s.items?.forEach(i => csvRows.push([s.entry_date, s.distributor?.name||'', i.products?.name||'', i.quantity, i.unit_price, i.total_amount, s.bill_sent?'Yes':'No'])))
      }
      // add others as needed
    }

    if (!csvRows.length) { toast.error('No data'); return }
    const csv = csvRows.map(r => r.map(v => `"${String(v||'').replace(/"/g,"'")}"`).join(',')).join('\n')
    const a   = document.createElement('a')
    a.href    = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `${reportType}_${fromDate}_to_${toDate}.csv`
    a.click()
    toast.success('Exported')
  }

  const Bar = ({ pct, color }) => (
    <div style={{ flex: 1, height: 5, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden', minWidth: 40, maxWidth: 100 }}>
      <div style={{ height: '100%', width: `${Math.min(100, pct || 0)}%`, background: color, borderRadius: 99, transition: 'width .5s' }} />
    </div>
  )

  const hasData    = rows !== null || summary !== null
  const showExport = (rows?.length > 0) || summary

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Reports</div>
          <div className="page-subtitle">P&L is based on cash collected — not billed amount</div>
        </div>
        {showExport && (
          <button className="btn btn-ghost" onClick={exportCSV}>
            <Download size={14} /> Export CSV
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="card" style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 210 }}>
            <label className="label">Report Type</label>
            <select className="input" value={reportType}
              onChange={e => { setReportType(e.target.value); setRows(null); setSummary(null) }}>
              {REPORT_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {reportType !== 'salary' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="label">From</label>
                <div style={{ position: 'relative' }}>
                  <Calendar size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                  <input type="date" className="input" style={{ paddingLeft: 32, minWidth: 150 }} value={fromDate} onChange={e => setFromDate(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="label">To</label>
                <div style={{ position: 'relative' }}>
                  <Calendar size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                  <input type="date" className="input" style={{ paddingLeft: 32, minWidth: 150 }} value={toDate} onChange={e => setToDate(e.target.value)} />
                </div>
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-end' }}>
            {[
              { l: 'Today',  f: () => { const t = today; setFromDate(t); setToDate(t) } },
              { l: '7 Days', f: () => { const d = new Date(); d.setDate(d.getDate()-7); setFromDate(d.toISOString().split('T')[0]); setToDate(today) } },
              { l: 'Month',  f: () => { setFromDate(today.slice(0,8)+'01'); setToDate(today) } },
            ].map(q => <button key={q.l} className="btn btn-ghost btn-sm" onClick={q.f}>{q.l}</button>)}
          </div>

          <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }} onClick={generate} disabled={loading}>
            {loading ? <><Loader2 size={14} className="spin" />Loading…</> : <><Search size={14} />Generate</>}
          </button>
        </div>
      </div>

      {/* ── OVERALL / P&L SUMMARY ── */}
      {summary && (reportType === 'overall' || reportType === 'pnl') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Top P&L banner */}
          <div className={`pnl-banner ${summary.netProfit >= 0 ? 'pnl-banner-profit' : 'pnl-banner-loss'}`}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: 6 }}>
                Net {summary.netProfit >= 0 ? 'Profit' : 'Loss'} · Cash Basis · {fromDate} to {toDate}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,5vw,42px)', fontWeight: 800, letterSpacing: '-0.02em', color: summary.netProfit >= 0 ? 'var(--green)' : 'var(--red)', lineHeight: 1 }}>
                {summary.netProfit >= 0 ? '+' : ''}{fmt(summary.netProfit)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
                {fmt(summary.totalCollected)} collected − {fmt(summary.totalExpenses)} expenses = <strong>{fmt(summary.netProfit)}</strong> &nbsp;|&nbsp; {summary.margin}% margin
              </div>
            </div>
            <div className="pnl-kpi-row">
              {[
                { l: 'Cash Collected',  v: fmt(summary.totalCollected), c: 'var(--green)'  },
                { l: 'Total Billed',    v: fmt(summary.totalBilled),    c: 'var(--blue)'   },
                { l: 'Uncollected',     v: fmt(summary.uncollected),    c: summary.uncollected > 0 ? 'var(--red)' : 'var(--green)' },
                { l: 'Total Expenses',  v: fmt(summary.totalExpenses),  c: 'var(--red)'    },
              ].map(k => (
                <div key={k.l} className="pnl-kpi">
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)' }}>{k.l}</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: k.c }}>{k.v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Uncollected warning */}
          {summary.uncollected > 0.01 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--yellow-dim)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 'var(--r-md)', padding: '12px 16px', color: 'var(--yellow)', fontSize: 13 }}>
              <AlertTriangle size={15} />
              <span>
                <strong>{fmt(summary.uncollected)}</strong> is billed but not yet collected from distributors.
                This amount is NOT counted in the profit above. Go to{' '}
                <a href="/dashboard/sales/payments" style={{ color: 'inherit', fontWeight: 600 }}>Payment Collection</a> to record received payments.
              </span>
            </div>
          )}

          {/* 3-column grid */}
          <div className="report-grid">
            {/* Income */}
            <div className="card rpt-card">
              <div className="rpt-card-hdr">
                <div className="rpt-icon" style={{ background: 'var(--green-dim)' }}><TrendingUp size={14} color="var(--green)" /></div>
                <div>
                  <div className="rpt-card-title">Cash Collected (Income)</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--green)' }}>{fmt(summary.totalCollected)}</div>
                </div>
              </div>

              <div className="rpt-section">By Distributor</div>
              {Object.keys(summary.collectedByDist).length === 0
                ? <div className="rpt-empty">No payments collected in this period</div>
                : Object.entries(summary.collectedByDist).sort((a,b) => b[1]-a[1]).map(([n,v]) => (
                  <div key={n} className="rpt-row">
                    <span className="rpt-name">{n}</span>
                    <Bar pct={summary.totalCollected > 0 ? (v/summary.totalCollected)*100 : 0} color="var(--green)" />
                    <span className="rpt-val" style={{ color: 'var(--green)' }}>{fmt(v)}</span>
                  </div>
                ))
              }

              {Object.keys(summary.collectedByMode).length > 0 && (
                <>
                  <div className="rpt-section" style={{ marginTop: 14 }}>By Payment Mode</div>
                  {Object.entries(summary.collectedByMode).map(([m, v]) => (
                    <div key={m} className="rpt-row">
                      <span className="rpt-name" style={{ textTransform: 'capitalize' }}>{m}</span>
                      <Bar pct={summary.totalCollected > 0 ? (v/summary.totalCollected)*100 : 0} color="var(--blue)" />
                      <span className="rpt-val" style={{ color: 'var(--blue)' }}>{fmt(v)}</span>
                    </div>
                  ))}
                </>
              )}

              {/* Billed reference */}
              <div className="rpt-section" style={{ marginTop: 14 }}>Billed This Period (Reference)</div>
              <div className="rpt-row">
                <span className="rpt-name">Total Billed</span>
                <span className="rpt-val" style={{ color: 'var(--blue)' }}>{fmt(summary.totalBilled)}</span>
              </div>
              <div className="rpt-row">
                <span className="rpt-name">Collected</span>
                <span className="rpt-val" style={{ color: 'var(--green)' }}>{fmt(summary.totalCollected)}</span>
              </div>
              <div className="rpt-row">
                <span className="rpt-name">Still Pending</span>
                <span className="rpt-val" style={{ color: summary.uncollected > 0 ? 'var(--red)' : 'var(--green)' }}>{fmt(summary.uncollected)}</span>
              </div>

              <div className="rpt-total"><span>Total Income (Cash)</span><span style={{ color: 'var(--green)' }}>{fmt(summary.totalCollected)}</span></div>
            </div>

            {/* Expenses */}
            <div className="card rpt-card">
              <div className="rpt-card-hdr">
                <div className="rpt-icon" style={{ background: 'var(--red-dim)' }}><TrendingDown size={14} color="var(--red)" /></div>
                <div>
                  <div className="rpt-card-title">Expenses</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--red)' }}>{fmt(summary.totalExpenses)}</div>
                </div>
              </div>

              {summary.totalDailyExp > 0 && (
                <>
                  <div className="rpt-section">Daily Expenses</div>
                  {Object.entries(summary.expByCategory).sort((a,b)=>b[1]-a[1]).map(([n,v]) => (
                    <div key={n} className="rpt-row">
                      <span className="rpt-name">{n}</span>
                      <Bar pct={summary.totalExpenses > 0 ? (v/summary.totalExpenses)*100 : 0} color="var(--brand)" />
                      <span className="rpt-val" style={{ color: 'var(--brand)' }}>{fmt(v)}</span>
                    </div>
                  ))}
                  <div className="rpt-subtotal"><span>Subtotal</span><span>{fmt(summary.totalDailyExp)}</span></div>
                </>
              )}

              {summary.totalSalary > 0 && (
                <div className="rpt-row rpt-row-single" style={{ marginTop: 8 }}>
                  <span className="rpt-name">Salary Paid</span>
                  <Bar pct={summary.totalExpenses > 0 ? (summary.totalSalary/summary.totalExpenses)*100 : 0} color="var(--blue)" />
                  <span className="rpt-val">{fmt(summary.totalSalary)}</span>
                </div>
              )}

              {summary.totalVehicle > 0 && (
                <>
                  <div className="rpt-section" style={{ marginTop: 10 }}>Vehicle Expenses</div>
                  {Object.entries(summary.vehicleByType).map(([n,v]) => (
                    <div key={n} className="rpt-row">
                      <span className="rpt-name" style={{ textTransform: 'capitalize' }}>{n}</span>
                      <Bar pct={summary.totalExpenses > 0 ? (v/summary.totalExpenses)*100 : 0} color="var(--yellow)" />
                      <span className="rpt-val" style={{ color: 'var(--yellow)' }}>{fmt(v)}</span>
                    </div>
                  ))}
                  <div className="rpt-subtotal"><span>Subtotal</span><span>{fmt(summary.totalVehicle)}</span></div>
                </>
              )}

              {summary.totalRawMat > 0 && (
                <div className="rpt-row rpt-row-single" style={{ marginTop: 8 }}>
                  <span className="rpt-name">Raw Material Cost</span>
                  <Bar pct={summary.totalExpenses > 0 ? (summary.totalRawMat/summary.totalExpenses)*100 : 0} color="var(--blue)" />
                  <span className="rpt-val">{fmt(summary.totalRawMat)}</span>
                </div>
              )}

              <div className="rpt-total"><span>Total Expenses</span><span style={{ color: 'var(--red)' }}>{fmt(summary.totalExpenses)}</span></div>
            </div>

            {/* Operations */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card rpt-card">
                <div className="rpt-card-hdr">
                  <div className="rpt-icon" style={{ background: 'rgba(74,222,128,0.12)' }}><FlaskConical size={14} color="var(--green)" /></div>
                  <div>
                    <div className="rpt-card-title">Production</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>{summary.totalProdQty.toLocaleString('en-IN')} units</div>
                  </div>
                </div>
                {Object.keys(summary.prodByProduct).length === 0
                  ? <div className="rpt-empty">No production data</div>
                  : Object.entries(summary.prodByProduct).sort((a,b)=>b[1].qty-a[1].qty).map(([n,d]) => (
                    <div key={n} className="rpt-row">
                      <span className="rpt-name">{n}</span>
                      <Bar pct={summary.totalProdQty > 0 ? (d.qty/summary.totalProdQty)*100 : 0} color="var(--green)" />
                      <span className="rpt-val">{d.qty.toLocaleString('en-IN')} <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{d.unit}</span></span>
                    </div>
                  ))
                }
              </div>

              {summary.attTotal > 0 && (
                <div className="card rpt-card">
                  <div className="rpt-card-hdr">
                    <div className="rpt-icon" style={{ background: 'var(--blue-dim)' }}><Users size={14} color="var(--blue)" /></div>
                    <div>
                      <div className="rpt-card-title">Attendance</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>{summary.attTotal} records</div>
                    </div>
                  </div>
                  {[
                    { label: 'Present',  val: summary.attPresent,  color: 'var(--green)'  },
                    { label: 'Absent',   val: summary.attAbsent,   color: 'var(--red)'    },
                    { label: 'Half Day', val: summary.attHalfDay,  color: 'var(--yellow)' },
                  ].map(a => (
                    <div key={a.label} className="rpt-row">
                      <span className="rpt-name">{a.label}</span>
                      <Bar pct={summary.attTotal > 0 ? (a.val/summary.attTotal)*100 : 0} color={a.color} />
                      <span className="rpt-val" style={{ color: a.color }}>{a.val}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── DETAIL TABLES ── */}
      {rows !== null && rows.length > 0 && (
        <div className="table-wrap">

          {reportType === 'production' && (
            <table>
              <thead><tr><th>Date</th><th>Product</th><th>Category</th><th>Batch</th><th>Quantity</th><th>Notes</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{fmtDate(r.entry_date)}</td>
                    <td style={{ fontWeight: 500 }}>{r.product?.name || '—'}</td>
                    <td>{r.product?.category ? <span className="badge badge-blue">{r.product.category}</span> : <span className="text-faint">—</span>}</td>
                    <td><span className="badge badge-orange">Batch {r.batch_no}</span></td>
                    <td><span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--green)' }}>{parseFloat(r.quantity).toLocaleString('en-IN')}</span> <span className="text-faint">{r.product?.unit}</span></td>
                    <td style={{ color: 'var(--text-2)' }}>{r.notes || <span className="text-faint">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'payments' && (
            <table>
              <thead><tr><th>Date</th><th>Distributor</th><th>Amount</th><th>Mode</th><th>Reference</th><th>Notes</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{fmtDate(r.entry_date)}</td>
                    <td style={{ fontWeight: 600 }}>{r.distributor?.name || '—'}</td>
                    <td><span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--green)', fontSize: 15 }}>{fmt(r.amount)}</span></td>
                    <td><span className="badge badge-blue">{r.payment_mode}</span></td>
                    <td style={{ color: 'var(--text-2)' }}>{r.reference_no || <span className="text-faint">—</span>}</td>
                    <td style={{ color: 'var(--text-2)' }}>{r.notes || <span className="text-faint">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'sales' && (
            <table>
              <thead><tr><th>Date</th><th>Distributor</th><th>Items</th><th>Billed</th><th>Bill Sent</th></tr></thead>
              <tbody>
                {rows.map(sale => {
                  const total  = sale.items.reduce((s,i) => s + parseFloat(i.total_amount||0), 0)
                  const isOpen = expanded[sale.id]
                  return [
                    <tr key={sale.id} style={{ cursor: 'pointer' }} onClick={() => setExpanded(p => ({ ...p, [sale.id]: !p[sale.id] }))}>
                      <td style={{ fontWeight: 500 }}>{fmtDate(sale.entry_date)}</td>
                      <td style={{ fontWeight: 600 }}>{sale.distributor?.name || '—'}</td>
                      <td><span className="badge badge-blue">{sale.items.length} items</span></td>
                      <td><span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--blue)' }}>{fmt(total)}</span></td>
                      <td><span style={{ display:'flex', alignItems:'center', gap:5 }}>{isOpen ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}<span className={`badge ${sale.bill_sent?'badge-green':'badge-yellow'}`}>{sale.bill_sent?'Sent':'Pending'}</span></span></td>
                    </tr>,
                    isOpen && sale.items.map(item => (
                      <tr key={item.id} style={{ background: 'var(--surface-2)', fontSize: 13 }}>
                        <td colSpan={2}></td>
                        <td style={{ color:'var(--text-2)', paddingLeft:20 }}>↳ {item.products?.name}</td>
                        <td style={{ color:'var(--text-2)' }}>{parseFloat(item.quantity)} {item.products?.unit}</td>
                        <td style={{ color:'var(--blue)', fontWeight:600 }}>{fmt(item.total_amount)}</td>
                      </tr>
                    ))
                  ]
                })}
              </tbody>
            </table>
          )}

          {reportType === 'workers' && (
            <table>
              <thead><tr><th>Date</th><th>Worker</th><th>Role</th><th>Status</th><th>Notes</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight:500 }}>{fmtDate(r.entry_date)}</td>
                    <td style={{ fontWeight:500 }}>{r.worker?.name||'—'}</td>
                    <td>{r.worker?.role?<span className="badge badge-blue">{r.worker.role}</span>:<span className="text-faint">—</span>}</td>
                    <td><span className={`badge ${r.status==='present'?'badge-green':r.status==='absent'?'badge-red':r.status==='half_day'?'badge-yellow':'badge-orange'}`}>{r.status.replace('_',' ')}</span></td>
                    <td style={{ color:'var(--text-2)' }}>{r.notes||<span className="text-faint">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'salary' && (
            <table>
              <thead><tr><th>Month</th><th>Worker</th><th>Type</th><th>Days</th><th>Gross</th><th>Paid</th><th>Remaining</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight:500 }}>{r.month}</td>
                    <td style={{ fontWeight:500 }}>{r.worker?.name||'—'}</td>
                    <td><span className={`badge ${r.worker?.salary_type==='fixed'?'badge-yellow':'badge-orange'}`}>{r.worker?.salary_type==='fixed'?'Fixed':'Daily'}</span></td>
                    <td>{r.working_days??<span className="text-faint">—</span>}</td>
                    <td style={{ fontFamily:'var(--font-display)',fontWeight:600 }}>{fmt(r.gross_amount)}</td>
                    <td style={{ color:'var(--green)',fontWeight:600 }}>{fmt(r.paid_amount)}</td>
                    <td style={{ color:parseFloat(r.remaining)>0?'var(--red)':'var(--green)',fontWeight:600 }}>{fmt(r.remaining)}</td>
                    <td><span className={`badge ${r.payment_status==='paid'?'badge-green':r.payment_status==='partial'?'badge-yellow':'badge-red'}`}>{r.payment_status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'expenses' && (
            <table>
              <thead><tr><th>Date</th><th>Category</th><th>Amount</th><th>Notes</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight:500 }}>{fmtDate(r.entry_date)}</td>
                    <td><span className="badge badge-orange">{r.category?.name||'Other'}</span></td>
                    <td style={{ fontFamily:'var(--font-display)',fontWeight:700,color:'var(--brand)' }}>{fmt(r.amount)}</td>
                    <td style={{ color:'var(--text-2)' }}>{r.notes||<span className="text-faint">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'raw_material' && (
            <table>
              <thead><tr><th>Date</th><th>Material</th><th>Unit</th><th>Qty</th><th>Unit Price</th><th>Total</th><th>Supplier</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight:500 }}>{fmtDate(r.entry_date)}</td>
                    <td style={{ fontWeight:500 }}>{r.raw_material?.name||'—'}</td>
                    <td><span className="badge badge-orange">{r.raw_material?.unit||'—'}</span></td>
                    <td style={{ color:'var(--green)',fontWeight:600 }}>+{parseFloat(r.quantity).toLocaleString('en-IN')}</td>
                    <td>{r.unit_price?`₹${parseFloat(r.unit_price).toFixed(2)}`:<span className="text-faint">—</span>}</td>
                    <td style={{ fontWeight:600 }}>{r.unit_price?fmt(r.quantity*r.unit_price):<span className="text-faint">—</span>}</td>
                    <td style={{ color:'var(--text-2)' }}>{r.supplier||<span className="text-faint">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'vehicles' && (
            <table>
              <thead><tr><th>Date</th><th>Vehicle</th><th>Type</th><th>Distributor</th><th>Distance</th><th>Total</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight:500 }}>{fmtDate(r.entry_date)}</td>
                    <td style={{ fontWeight:500 }}>{r.vehicle?.name||'—'}</td>
                    <td><span className="badge badge-blue">{r.expense_type}</span></td>
                    <td style={{ color:'var(--text-2)' }}>{r.distributor?.name||<span className="text-faint">—</span>}</td>
                    <td>{r.distance_km?`${r.distance_km} km`:<span className="text-faint">—</span>}</td>
                    <td style={{ fontFamily:'var(--font-display)',fontWeight:700,color:'var(--brand)' }}>{fmt(r.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'partners' && (
            <table>
              <thead><tr><th>Date</th><th>Partner</th><th>Type</th><th>Amount</th><th>Purpose</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight:500 }}>{fmtDate(r.entry_date)}</td>
                    <td style={{ fontWeight:500 }}>{r.partner?.name||'—'}</td>
                    <td><span className="badge badge-blue">{r.transaction_type.replace(/_/g,' ')}</span></td>
                    <td style={{ fontFamily:'var(--font-display)',fontWeight:700,color:['given','loan_given'].includes(r.transaction_type)?'var(--red)':'var(--green)' }}>
                      {['given','loan_given'].includes(r.transaction_type)?'-':'+'}₹{parseFloat(r.amount).toLocaleString('en-IN')}
                    </td>
                    <td style={{ color:'var(--text-2)' }}>{r.purpose||<span className="text-faint">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {rows !== null && rows.length === 0 && (
        <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text-3)' }}>
          <FileBarChart2 size={36} style={{ margin:'0 auto 14px', opacity:0.2, display:'block' }} />
          <div style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:700, color:'var(--text-2)', marginBottom:6 }}>No records found</div>
          <div style={{ fontSize:13 }}>Try a different date range</div>
        </div>
      )}

      {!hasData && !loading && (
        <div style={{ textAlign:'center', padding:'80px 20px', color:'var(--text-3)' }}>
          <FileBarChart2 size={40} style={{ margin:'0 auto 16px', opacity:0.2, display:'block' }} />
          <div style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:700, color:'var(--text-2)', marginBottom:6 }}>Select a report and click Generate</div>
          <div style={{ fontSize:13 }}>P&L is based on cash actually collected — not billed amount</div>
        </div>
      )}

      <style>{`
        * {
          box-sizing: border-box;
        }
        .pnl-banner { display:flex; align-items:center; justify-content:space-between; padding:22px 28px; border-radius:var(--r-lg); background:var(--surface); flex-wrap:wrap; gap:20px; border:1px solid var(--border-2); }
        .pnl-banner-profit { border-top:3px solid var(--green); }
        .pnl-banner-loss   { border-top:3px solid var(--red); }
        .pnl-kpi-row { display:flex; gap:0; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--r-md); overflow:hidden; }
        .pnl-kpi { display:flex; flex-direction:column; gap:4px; padding:12px 16px; text-align:center; border-right:1px solid var(--border); }
        .pnl-kpi:last-child { border-right:none; }
        .report-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; }
        .rpt-card { padding:18px; }
        .rpt-card-hdr { display:flex; align-items:center; gap:12px; margin-bottom:14px; padding-bottom:12px; border-bottom:1px solid var(--border); }
        .rpt-icon { width:34px; height:34px; border-radius:var(--r-sm); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .rpt-card-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.07em; color:var(--text-3); margin-bottom:3px; }
        .rpt-section { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:var(--text-3); margin:10px 0 6px; }
        .rpt-row { display:flex; align-items:center; gap:10px; padding:5px 0; border-bottom:1px solid var(--border); }
        .rpt-row:last-of-type { border-bottom:none; }
        .rpt-name { font-size:12.5px; color:var(--text-2); flex-shrink:0; max-width:40%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .rpt-val { font-size:12.5px; font-weight:600; white-space:nowrap; min-width:70px; text-align:right; }
        .rpt-total { display:flex; align-items:center; justify-content:space-between; padding:10px 0 0; margin-top:8px; border-top:2px solid var(--border); font-size:13px; font-weight:600; }
        .rpt-subtotal { display:flex; align-items:center; justify-content:space-between; font-size:12px; color:var(--text-3); padding:4px 0; }
        .rpt-empty { font-size:12px; color:var(--text-3); padding:8px 0; }
        :global(.spin) { animation:spin 0.7s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }
       @media (max-width: 900px) {
  .report-grid {
    grid-template-columns: 1fr;
  }

  .pnl-banner {
    flex-direction: column;
    align-items: stretch;
  }

  .pnl-kpi-row {
    flex-wrap: wrap;
    width: 100%;
  }

  .pnl-kpi {
    flex: 1 1 50%;
    min-width: 140px;
  }
}

@media (max-width: 640px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .page-header .btn {
    width: 100%;
  }

  .pnl-banner {
    padding: 16px;
  }

  .pnl-kpi-row {
    flex-direction: column;
  }

  .pnl-kpi {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }

  .pnl-kpi:last-child {
    border-bottom: none;
  }

  .rpt-row {
    flex-wrap: wrap;
    gap: 6px;
  }

  .rpt-name {
    max-width: 100%;
    width: 100%;
  }

  .rpt-val {
    min-width: auto;
  }

  .table-wrap {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  table {
    min-width: 700px;
  }

  .card {
    overflow: hidden;
  }
}
      `}</style>
    </div>
  )
}