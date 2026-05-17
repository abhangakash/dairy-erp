'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  FileBarChart2, Calendar, Search, Download,
  Loader2, FlaskConical, ShoppingCart, Users,
  Receipt, Package, Truck, HandCoins,
  TrendingUp, TrendingDown, ChevronDown, ChevronRight,
  BarChart3
} from 'lucide-react'

const REPORT_TYPES = [
  { value: 'overall',      label: 'Overall Summary',       icon: BarChart3    },
  { value: 'pnl',          label: 'Profit & Loss',         icon: TrendingUp   },
  { value: 'production',   label: 'Production',            icon: FlaskConical },
  { value: 'sales',        label: 'Sales',                 icon: ShoppingCart },
  { value: 'workers',      label: 'Worker Attendance',     icon: Users        },
  { value: 'salary',       label: 'Salary Payments',       icon: Users        },
  { value: 'expenses',     label: 'Daily Expenses',        icon: Receipt      },
  { value: 'raw_material', label: 'Raw Materials',         icon: Package      },
  { value: 'vehicles',     label: 'Vehicle Expenses',      icon: Truck        },
  { value: 'partners',     label: 'Partner Transactions',  icon: HandCoins    },
]

const fmt = n => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
const fmtDate = d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtTime = d => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

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

  // ── Fetch ─────────────────────────────────────────────────
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

  // ── Summary (Overall + P&L) ───────────────────────────────
  async function fetchSummaryReport() {
    const [
      salesResult,
      expResult,
      salaryResult,
      vehicleResult,
      rawMatResult,
      productionResult,
      attendanceResult,
    ] = await Promise.all([
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
        .select('quantity, unit_price, raw_materials(name)')
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate),

      supabase.from('daily_production')
        .select('quantity, products(name, unit)')
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate),

      supabase.from('worker_attendance')
        .select('status, workers(name)')
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate),
    ])

    // ── Income ──
    const salesItems    = salesResult.data   || []
    const totalSales    = salesItems.reduce((s, i) => s + parseFloat(i.total_amount || 0), 0)
    const salesByProduct = {}
    const salesByDist    = {}
    salesItems.forEach(i => {
      const p = i.products?.name || 'Unknown'
      const d = i.daily_sales?.distributors?.name || 'Unknown'
      salesByProduct[p] = (salesByProduct[p] || 0) + parseFloat(i.total_amount || 0)
      salesByDist[d]    = (salesByDist[d]    || 0) + parseFloat(i.total_amount || 0)
    })

    // ── Expenses ──
    const expItems      = expResult.data   || []
    const totalDailyExp = expItems.reduce((s, i) => s + parseFloat(i.amount || 0), 0)
    const expByCategory = {}
    expItems.forEach(i => {
      const c = i.expense_categories?.name || 'Other'
      expByCategory[c] = (expByCategory[c] || 0) + parseFloat(i.amount || 0)
    })

    const totalSalary   = (salaryResult.data || []).reduce((s, r) => s + parseFloat(r.paid_amount || 0), 0)

    const vehicleItems  = vehicleResult.data || []
    const totalVehicle  = vehicleItems.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0)
    const vehicleByType = {}
    vehicleItems.forEach(r => {
      vehicleByType[r.expense_type] = (vehicleByType[r.expense_type] || 0) + parseFloat(r.total_amount || 0)
    })

    const rawItems      = rawMatResult.data || []
    const totalRawMat   = rawItems.reduce((s, r) => s + parseFloat(r.quantity || 0) * parseFloat(r.unit_price || 0), 0)

    const totalExpenses = totalDailyExp + totalSalary + totalVehicle + totalRawMat
    const netProfit     = totalSales - totalExpenses
    const margin        = totalSales > 0 ? ((netProfit / totalSales) * 100).toFixed(1) : '0.0'

    // ── Production ──
    const prodItems     = productionResult.data || []
    const totalProdQty  = prodItems.reduce((s, r) => s + parseFloat(r.quantity || 0), 0)
    const prodByProduct = {}
    prodItems.forEach(r => {
      const n = r.products?.name || 'Unknown'
      if (!prodByProduct[n]) prodByProduct[n] = { qty: 0, unit: r.products?.unit || '' }
      prodByProduct[n].qty += parseFloat(r.quantity || 0)
    })

    // ── Attendance ──
    const attItems    = attendanceResult.data || []
    const attPresent  = attItems.filter(a => a.status === 'present').length
    const attAbsent   = attItems.filter(a => a.status === 'absent').length
    const attHalfDay  = attItems.filter(a => a.status === 'half_day').length

    setSummary({
      // Income
      totalSales, salesByProduct, salesByDist,
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

  // ── Detail reports ────────────────────────────────────────
  async function fetchDetailReport() {
    let result = []

    if (reportType === 'production') {
      // Fetch separately to avoid RLS join issues
      const { data: prod, error: pe } = await supabase
        .from('daily_production')
        .select('id, product_id, entry_date, batch_no, quantity, notes, entered_at')
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate)
        .order('entry_date', { ascending: false })
        .order('entered_at', { ascending: false })

      if (pe) throw pe
      if (!prod || prod.length === 0) { setRows([]); toast('No production records found', { icon: '📭' }); return }

      // Fetch products separately
      const productIds = [...new Set(prod.map(r => r.product_id).filter(Boolean))]
      const { data: products } = await supabase
        .from('products')
        .select('id, name, unit, category')
        .in('id', productIds)

      const productMap = {}
      ;(products || []).forEach(p => { productMap[p.id] = p })

      result = prod.map(r => ({
        ...r,
        product: productMap[r.product_id] || null,
      }))
    }

    else if (reportType === 'sales') {
      const { data: sales, error: se } = await supabase
        .from('daily_sales')
        .select('id, entry_date, bill_sent, entered_at, notes, distributor_id')
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate)
        .order('entry_date', { ascending: false })
      if (se) throw se

      if (!sales || sales.length === 0) { setRows([]); toast('No sales found', { icon: '📭' }); return }

      const saleIds = sales.map(s => s.id)
      const distIds = [...new Set(sales.map(s => s.distributor_id).filter(Boolean))]

      const [{ data: items }, { data: dists }] = await Promise.all([
        supabase.from('daily_sale_items')
          .select('id, sale_id, product_id, quantity, unit_price, total_amount, products(name, unit)')
          .in('sale_id', saleIds),
        supabase.from('distributors')
          .select('id, name, phone, route')
          .in('id', distIds),
      ])

      const distMap  = {}
      ;(dists || []).forEach(d => { distMap[d.id] = d })
      const itemsBySale = {}
      ;(items || []).forEach(i => {
        if (!itemsBySale[i.sale_id]) itemsBySale[i.sale_id] = []
        itemsBySale[i.sale_id].push(i)
      })

      result = sales.map(s => ({
        ...s,
        distributor: distMap[s.distributor_id] || null,
        items:       itemsBySale[s.id]         || [],
      }))
    }

    else if (reportType === 'workers') {
      const { data, error } = await supabase
        .from('worker_attendance')
        .select('id, entry_date, status, notes, entered_at, worker_id')
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate)
        .order('entry_date', { ascending: false })
      if (error) throw error

      if (!data || data.length === 0) { setRows([]); toast('No attendance records', { icon: '📭' }); return }

      const wids = [...new Set(data.map(r => r.worker_id).filter(Boolean))]
      const { data: workers } = await supabase.from('workers').select('id, name, role').in('id', wids)
      const wmap = {}
      ;(workers || []).forEach(w => { wmap[w.id] = w })
      result = data.map(r => ({ ...r, worker: wmap[r.worker_id] || null }))
    }

    else if (reportType === 'salary') {
      const { data, error } = await supabase
        .from('salary_payments')
        .select('id, month, working_days, gross_amount, paid_amount, remaining, payment_status, paid_date, entered_at, worker_id')
        .order('month', { ascending: false })
      if (error) throw error

      if (!data || data.length === 0) { setRows([]); toast('No salary records', { icon: '📭' }); return }

      const wids = [...new Set(data.map(r => r.worker_id).filter(Boolean))]
      const { data: workers } = await supabase.from('workers').select('id, name, role, salary_type').in('id', wids)
      const wmap = {}
      ;(workers || []).forEach(w => { wmap[w.id] = w })
      result = data.map(r => ({ ...r, worker: wmap[r.worker_id] || null }))
    }

    else if (reportType === 'expenses') {
      const { data, error } = await supabase
        .from('daily_expenses')
        .select('id, entry_date, amount, notes, entered_at, category_id')
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate)
        .order('entry_date', { ascending: false })
      if (error) throw error

      if (!data || data.length === 0) { setRows([]); toast('No expenses', { icon: '📭' }); return }

      const catIds = [...new Set(data.map(r => r.category_id).filter(Boolean))]
      const { data: cats } = catIds.length > 0
        ? await supabase.from('expense_categories').select('id, name').in('id', catIds)
        : { data: [] }
      const cmap = {}
      ;(cats || []).forEach(c => { cmap[c.id] = c })
      result = data.map(r => ({ ...r, category: r.category_id ? cmap[r.category_id] : null }))
    }

    else if (reportType === 'raw_material') {
      const { data, error } = await supabase
        .from('raw_material_stock_entries')
        .select('id, entry_date, quantity, unit_price, supplier, entered_at, raw_material_id')
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate)
        .order('entry_date', { ascending: false })
      if (error) throw error

      if (!data || data.length === 0) { setRows([]); toast('No stock entries', { icon: '📭' }); return }

      const rmIds = [...new Set(data.map(r => r.raw_material_id).filter(Boolean))]
      const { data: rms } = await supabase.from('raw_materials').select('id, name, unit').in('id', rmIds)
      const rmmap = {}
      ;(rms || []).forEach(r => { rmmap[r.id] = r })
      result = data.map(r => ({ ...r, raw_material: rmmap[r.raw_material_id] || null }))
    }

    else if (reportType === 'vehicles') {
      const { data, error } = await supabase
        .from('vehicle_expenses')
        .select('id, entry_date, expense_type, distance_km, rate_per_km, auto_amount, manual_amount, total_amount, notes, entered_at, vehicle_id, distributor_id')
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate)
        .order('entry_date', { ascending: false })
      if (error) throw error

      if (!data || data.length === 0) { setRows([]); toast('No vehicle expenses', { icon: '📭' }); return }

      const vids = [...new Set(data.map(r => r.vehicle_id).filter(Boolean))]
      const dids = [...new Set(data.map(r => r.distributor_id).filter(Boolean))]
      const [{ data: vehs }, { data: dists }] = await Promise.all([
        vids.length > 0 ? supabase.from('vehicles').select('id, name, fuel_type').in('id', vids) : { data: [] },
        dids.length > 0 ? supabase.from('distributors').select('id, name').in('id', dids) : { data: [] },
      ])
      const vmap = {}; (vehs  || []).forEach(v => { vmap[v.id] = v })
      const dmap = {}; (dists || []).forEach(d => { dmap[d.id] = d })
      result = data.map(r => ({ ...r, vehicle: vmap[r.vehicle_id] || null, distributor: dmap[r.distributor_id] || null }))
    }

    else if (reportType === 'partners') {
      const { data, error } = await supabase
        .from('partner_transactions')
        .select('id, entry_date, transaction_type, amount, purpose, notes, entered_at, partner_id')
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate)
        .order('entry_date', { ascending: false })
      if (error) throw error

      if (!data || data.length === 0) { setRows([]); toast('No transactions', { icon: '📭' }); return }

      const pids = [...new Set(data.map(r => r.partner_id).filter(Boolean))]
      const { data: partners } = await supabase.from('partners').select('id, name').in('id', pids)
      const pmap = {}; (partners || []).forEach(p => { pmap[p.id] = p })
      result = data.map(r => ({ ...r, partner: pmap[r.partner_id] || null }))
    }

    setRows(result)
    toast.success(`${result.length} records loaded`)
  }

  // ── CSV export ────────────────────────────────────────────
  function exportCSV() {
    let csvRows = []

    if ((reportType === 'overall' || reportType === 'pnl') && summary) {
      csvRows = [
        ['DAIRY ERP — REPORT', `${fromDate} to ${toDate}`],
        [],
        ['INCOME'],
        ['Total Sales Revenue', summary.totalSales.toFixed(2)],
        [],
        ['Sales by Product'],
        ...Object.entries(summary.salesByProduct).map(([n, v]) => [n, v.toFixed(2)]),
        [],
        ['Sales by Distributor'],
        ...Object.entries(summary.salesByDist).map(([n, v]) => [n, v.toFixed(2)]),
        [],
        ['EXPENSES'],
        ['Daily Expenses', summary.totalDailyExp.toFixed(2)],
        ...Object.entries(summary.expByCategory).map(([n, v]) => [`  ${n}`, v.toFixed(2)]),
        ['Salary Paid', summary.totalSalary.toFixed(2)],
        ['Vehicle Expenses', summary.totalVehicle.toFixed(2)],
        ...Object.entries(summary.vehicleByType).map(([n, v]) => [`  ${n}`, v.toFixed(2)]),
        ['Raw Material Cost', summary.totalRawMat.toFixed(2)],
        ['Total Expenses', summary.totalExpenses.toFixed(2)],
        [],
        ['NET PROFIT / LOSS', summary.netProfit.toFixed(2)],
        ['Profit Margin %', summary.margin + '%'],
        [],
        ['PRODUCTION'],
        ...Object.entries(summary.prodByProduct).map(([n, d]) => [n, d.qty + ' ' + d.unit]),
        [],
        ['ATTENDANCE'],
        ['Present', summary.attPresent],
        ['Absent', summary.attAbsent],
        ['Half Day', summary.attHalfDay],
      ]
    }
    else if (rows && rows.length > 0) {
      if (reportType === 'production') {
        csvRows = [['Date','Product','Category','Batch','Quantity','Unit','Notes'],
          ...rows.map(r => [r.entry_date, r.product?.name||'', r.product?.category||'', r.batch_no, r.quantity, r.product?.unit||'', r.notes||''])]
      }
      else if (reportType === 'sales') {
        csvRows = [['Date','Distributor','Route','Product','Qty','Unit Price','Total','Bill Sent']]
        rows.forEach(s => s.items?.forEach(i => csvRows.push([s.entry_date, s.distributor?.name||'', s.distributor?.route||'', i.products?.name||'', i.quantity, i.unit_price, i.total_amount, s.bill_sent ? 'Yes':'No'])))
      }
      else if (reportType === 'workers') {
        csvRows = [['Date','Worker','Role','Status','Notes'],
          ...rows.map(r => [r.entry_date, r.worker?.name||'', r.worker?.role||'', r.status, r.notes||''])]
      }
      else if (reportType === 'salary') {
        csvRows = [['Month','Worker','Type','Days','Gross','Paid','Remaining','Status'],
          ...rows.map(r => [r.month, r.worker?.name||'', r.worker?.salary_type||'', r.working_days||'', r.gross_amount, r.paid_amount, r.remaining, r.payment_status])]
      }
      else if (reportType === 'expenses') {
        csvRows = [['Date','Category','Amount','Notes'],
          ...rows.map(r => [r.entry_date, r.category?.name||'Other', r.amount, r.notes||''])]
      }
      else if (reportType === 'raw_material') {
        csvRows = [['Date','Material','Unit','Qty','Unit Price','Total','Supplier'],
          ...rows.map(r => [r.entry_date, r.raw_material?.name||'', r.raw_material?.unit||'', r.quantity, r.unit_price||'', r.unit_price?(r.quantity*r.unit_price).toFixed(2):'', r.supplier||''])]
      }
      else if (reportType === 'vehicles') {
        csvRows = [['Date','Vehicle','Type','Distributor','Distance','Total'],
          ...rows.map(r => [r.entry_date, r.vehicle?.name||'', r.expense_type, r.distributor?.name||'', r.distance_km||'', r.total_amount])]
      }
      else if (reportType === 'partners') {
        csvRows = [['Date','Partner','Type','Amount','Purpose'],
          ...rows.map(r => [r.entry_date, r.partner?.name||'', r.transaction_type, r.amount, r.purpose||''])]
      }
    }

    if (!csvRows.length) { toast.error('No data to export'); return }
    const csv = csvRows.map(r => r.map(v => `"${String(v).replace(/"/g,"'")}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `${reportType}_${fromDate}_to_${toDate}.csv`
    a.click()
    toast.success('Exported')
  }

  const hasData    = rows !== null || summary !== null
  const showExport = (rows && rows.length > 0) || summary

  // ── Bar helper ────────────────────────────────────────────
  const Bar = ({ pct, color }) => (
    <div style={{ flex: 1, height: 5, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden', minWidth: 40, maxWidth: 100 }}>
      <div style={{ height: '100%', width: `${Math.min(100, pct || 0)}%`, background: color, borderRadius: 99, transition: 'width .5s' }} />
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Reports</div>
          <div className="page-subtitle">Date-range reports for every module</div>
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
            <label className="label">Report Type</label>
            <select className="input" value={reportType}
              onChange={e => { setReportType(e.target.value); setRows(null); setSummary(null) }}>
              {REPORT_TYPES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {reportType !== 'salary' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="label">From Date</label>
                <div style={{ position: 'relative' }}>
                  <Calendar size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                  <input type="date" className="input" style={{ paddingLeft: 32, minWidth: 155 }}
                    value={fromDate} onChange={e => setFromDate(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="label">To Date</label>
                <div style={{ position: 'relative' }}>
                  <Calendar size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                  <input type="date" className="input" style={{ paddingLeft: 32, minWidth: 155 }}
                    value={toDate} onChange={e => setToDate(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* Quick range */}
          <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-end' }}>
            {[
              { label: 'Today',  fn: () => { const t = today; setFromDate(t); setToDate(t) } },
              { label: '7 Days', fn: () => { const f = new Date(); f.setDate(f.getDate()-7); setFromDate(f.toISOString().split('T')[0]); setToDate(today) } },
              { label: 'Month',  fn: () => { setFromDate(today.slice(0,8)+'01'); setToDate(today) } },
            ].map(q => (
              <button key={q.label} className="btn btn-ghost btn-sm" onClick={q.fn}>{q.label}</button>
            ))}
          </div>

          <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }}
            onClick={generate} disabled={loading}>
            {loading ? <><Loader2 size={14} className="spin" />Loading…</> : <><Search size={14} />Generate</>}
          </button>
        </div>
      </div>

      {/* ── OVERALL / P&L SUMMARY ── */}
      {summary && (reportType === 'overall' || reportType === 'pnl') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Top banner */}
          <div className={`pnl-banner ${summary.netProfit >= 0 ? 'pnl-profit' : 'pnl-loss'}`}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: 6 }}>
                Net {summary.netProfit >= 0 ? 'Profit' : 'Loss'} · {fromDate} to {toDate}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,5vw,42px)', fontWeight: 800, letterSpacing: '-0.02em', color: summary.netProfit >= 0 ? 'var(--green)' : 'var(--red)', lineHeight: 1 }}>
                {summary.netProfit >= 0 ? '+' : ''}{fmt(summary.netProfit)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 5 }}>
                {fmt(summary.totalSales)} income − {fmt(summary.totalExpenses)} expenses = <strong>{fmt(summary.netProfit)}</strong> &nbsp;|&nbsp; {summary.margin}% margin
              </div>
            </div>
            <div className="pnl-kpi-row">
              {[
                { label: 'Total Income',   val: fmt(summary.totalSales),    c: 'var(--green)' },
                { label: 'Total Expenses', val: fmt(summary.totalExpenses),  c: 'var(--red)'   },
                { label: 'Profit Margin',  val: summary.margin + '%',        c: summary.netProfit >= 0 ? 'var(--green)' : 'var(--red)' },
              ].map(k => (
                <div key={k.label} className="pnl-kpi">
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)' }}>{k.label}</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: k.c }}>{k.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 3-column grid */}
          <div className="report-grid">

            {/* Income */}
            <div className="card rpt-card">
              <div className="rpt-card-hdr">
                <div className="rpt-icon rpt-icon-green"><TrendingUp size={14} color="var(--green)" /></div>
                <div>
                  <div className="rpt-card-title">Income</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--green)' }}>{fmt(summary.totalSales)}</div>
                </div>
              </div>
              <div className="rpt-section">Sales by Product</div>
              {Object.keys(summary.salesByProduct).length === 0
                ? <div className="rpt-empty">No sales in this period</div>
                : Object.entries(summary.salesByProduct).sort((a,b) => b[1]-a[1]).map(([n,v]) => (
                  <div key={n} className="rpt-row">
                    <span className="rpt-name">{n}</span>
                    <Bar pct={summary.totalSales > 0 ? (v/summary.totalSales)*100 : 0} color="var(--green)" />
                    <span className="rpt-val" style={{ color: 'var(--green)' }}>{fmt(v)}</span>
                  </div>
                ))
              }
              {Object.keys(summary.salesByDist).length > 0 && (
                <>
                  <div className="rpt-section" style={{ marginTop: 14 }}>By Distributor</div>
                  {Object.entries(summary.salesByDist).sort((a,b) => b[1]-a[1]).map(([n,v]) => (
                    <div key={n} className="rpt-row">
                      <span className="rpt-name">{n}</span>
                      <Bar pct={summary.totalSales > 0 ? (v/summary.totalSales)*100 : 0} color="var(--blue)" />
                      <span className="rpt-val" style={{ color: 'var(--blue)' }}>{fmt(v)}</span>
                    </div>
                  ))}
                </>
              )}
              <div className="rpt-total"><span>Total Revenue</span><span style={{ color: 'var(--green)' }}>{fmt(summary.totalSales)}</span></div>
            </div>

            {/* Expenses */}
            <div className="card rpt-card">
              <div className="rpt-card-hdr">
                <div className="rpt-icon rpt-icon-red"><TrendingDown size={14} color="var(--red)" /></div>
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
                  <Bar pct={summary.totalExpenses > 0 ? (summary.totalSalary/summary.totalExpenses)*100 : 0} color="var(--purple, #a78bfa)" />
                  <span className="rpt-val" style={{ color: 'var(--text)' }}>{fmt(summary.totalSalary)}</span>
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
                  <span className="rpt-val" style={{ color: 'var(--text)' }}>{fmt(summary.totalRawMat)}</span>
                </div>
              )}

              <div className="rpt-total"><span>Total Expenses</span><span style={{ color: 'var(--red)' }}>{fmt(summary.totalExpenses)}</span></div>
            </div>

            {/* Operations */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Production */}
              <div className="card rpt-card">
                <div className="rpt-card-hdr">
                  <div className="rpt-icon" style={{ background: 'rgba(74,222,128,0.12)' }}><FlaskConical size={14} color="var(--green)" /></div>
                  <div>
                    <div className="rpt-card-title">Production</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>
                      {summary.totalProdQty.toLocaleString('en-IN')} units
                    </div>
                  </div>
                </div>
                {Object.keys(summary.prodByProduct).length === 0
                  ? <div className="rpt-empty">No production data</div>
                  : Object.entries(summary.prodByProduct).sort((a,b) => b[1].qty-a[1].qty).map(([n,d]) => (
                    <div key={n} className="rpt-row">
                      <span className="rpt-name">{n}</span>
                      <Bar pct={summary.totalProdQty > 0 ? (d.qty/summary.totalProdQty)*100 : 0} color="var(--green)" />
                      <span className="rpt-val">{d.qty.toLocaleString('en-IN')} <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{d.unit}</span></span>
                    </div>
                  ))
                }
              </div>

              {/* Attendance */}
              {summary.attTotal > 0 && (
                <div className="card rpt-card">
                  <div className="rpt-card-hdr">
                    <div className="rpt-icon" style={{ background: 'rgba(96,165,250,0.12)' }}><Users size={14} color="var(--blue)" /></div>
                    <div>
                      <div className="rpt-card-title">Attendance</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{summary.attTotal} records</div>
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

          {/* PRODUCTION */}
          {reportType === 'production' && (
            <table>
              <thead><tr><th>Date</th><th>Product</th><th>Category</th><th>Batch</th><th>Quantity</th><th>Notes</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{fmtDate(r.entry_date)}</td>
                    <td style={{ fontWeight: 500 }}>{r.product?.name || <span className="text-faint">Unknown</span>}</td>
                    <td>{r.product?.category ? <span className="badge badge-blue">{r.product.category}</span> : <span className="text-faint">—</span>}</td>
                    <td><span className="badge badge-orange">Batch {r.batch_no}</span></td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--green)' }}>
                        {parseFloat(r.quantity).toLocaleString('en-IN')}
                      </span>
                      {r.product?.unit && <span className="text-faint" style={{ marginLeft: 4 }}>{r.product.unit}</span>}
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>{r.notes || <span className="text-faint">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* SALES */}
          {reportType === 'sales' && (
            <table>
              <thead><tr><th>Date</th><th>Distributor</th><th>Route</th><th>Items</th><th>Total</th><th>Bill Sent</th></tr></thead>
              <tbody>
                {rows.map(sale => {
                  const total  = sale.items.reduce((s,i) => s + parseFloat(i.total_amount||0), 0)
                  const isOpen = expanded[sale.id]
                  return [
                    <tr key={sale.id} style={{ cursor: 'pointer' }}
                      onClick={() => setExpanded(p => ({ ...p, [sale.id]: !p[sale.id] }))}>
                      <td style={{ fontWeight: 500 }}>{fmtDate(sale.entry_date)}</td>
                      <td style={{ fontWeight: 600 }}>{sale.distributor?.name || '—'}</td>
                      <td style={{ color: 'var(--text-2)' }}>{sale.distributor?.route || <span className="text-faint">—</span>}</td>
                      <td><span className="badge badge-blue">{sale.items.length} items</span></td>
                      <td><span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--green)' }}>{fmt(total)}</span></td>
                      <td>
                        <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                          {isOpen ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
                          <span className={`badge ${sale.bill_sent?'badge-green':'badge-yellow'}`}>{sale.bill_sent?'Sent ✓':'Pending'}</span>
                        </span>
                      </td>
                    </tr>,
                    isOpen && sale.items.map(item => (
                      <tr key={item.id} style={{ background: 'var(--surface-2)', fontSize: 13 }}>
                        <td colSpan={2}></td>
                        <td style={{ color:'var(--text-2)', paddingLeft:20 }}>↳ {item.products?.name}</td>
                        <td style={{ color:'var(--text-2)' }}>{parseFloat(item.quantity)} {item.products?.unit}</td>
                        <td style={{ color:'var(--text-2)' }}>₹{parseFloat(item.unit_price).toFixed(2)}/unit</td>
                        <td style={{ color:'var(--green)', fontWeight:600 }}>{fmt(item.total_amount)}</td>
                      </tr>
                    ))
                  ]
                })}
              </tbody>
            </table>
          )}

          {/* WORKERS ATTENDANCE */}
          {reportType === 'workers' && (
            <table>
              <thead><tr><th>Date</th><th>Worker</th><th>Role</th><th>Status</th><th>Notes</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{fmtDate(r.entry_date)}</td>
                    <td style={{ fontWeight: 500 }}>{r.worker?.name || '—'}</td>
                    <td>{r.worker?.role ? <span className="badge badge-blue">{r.worker.role}</span> : <span className="text-faint">—</span>}</td>
                    <td><span className={`badge ${r.status==='present'?'badge-green':r.status==='absent'?'badge-red':r.status==='half_day'?'badge-yellow':'badge-orange'}`}>{r.status.replace('_',' ')}</span></td>
                    <td style={{ color:'var(--text-2)' }}>{r.notes||<span className="text-faint">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
{/* SALARY */}
          {reportType === 'salary' && (
            <table>
              <thead><tr><th>Month</th><th>Worker</th><th>Type</th><th>Days</th><th>Gross</th><th>Paid</th><th>Remaining</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight:500 }}>{r.month}</td>
                    <td style={{ fontWeight:500 }}>{r.worker?.name||'—'}</td>
                    <td><span className={`badge ${r.worker?.salary_type==='fixed'?'badge-yellow':'badge-orange'}`}>{r.worker?.salary_type==='fixed'?'Fixed':'Daily'}</span></td>
                    <td style={{ color:'var(--text-2)' }}>{r.working_days??<span className="text-faint">—</span>}</td>
                    <td style={{ fontFamily:'var(--font-display)',fontWeight:600 }}>{fmt(r.gross_amount)}</td>
                    <td style={{ color:'var(--green)',fontWeight:600 }}>{fmt(r.paid_amount)}</td>
                    <td style={{ color:parseFloat(r.remaining)>0?'var(--yellow)':'var(--green)',fontWeight:600 }}>{fmt(r.remaining)}</td>
                    <td><span className={`badge ${r.payment_status==='paid'?'badge-green':r.payment_status==='partial'?'badge-yellow':'badge-red'}`}>{r.payment_status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* EXPENSES */}
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

          {/* RAW MATERIAL */}
          {reportType === 'raw_material' && (
            <table>
              <thead><tr><th>Date</th><th>Material</th><th>Unit</th><th>Qty Received</th><th>Unit Price</th><th>Total Cost</th><th>Supplier</th></tr></thead>
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

          {/* VEHICLES */}
          {reportType === 'vehicles' && (
            <table>
              <thead><tr><th>Date</th><th>Vehicle</th><th>Type</th><th>Distributor</th><th>Distance</th><th>Auto Amt</th><th>Manual Amt</th><th>Total</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight:500 }}>{fmtDate(r.entry_date)}</td>
                    <td style={{ fontWeight:500 }}>{r.vehicle?.name||'—'}</td>
                    <td><span className="badge badge-blue">{r.expense_type}</span></td>
                    <td style={{ color:'var(--text-2)' }}>{r.distributor?.name||<span className="text-faint">—</span>}</td>
                    <td>{r.distance_km?`${r.distance_km} km`:<span className="text-faint">—</span>}</td>
                    <td style={{ color:'var(--text-2)' }}>{r.auto_amount?`₹${parseFloat(r.auto_amount).toFixed(2)}`:<span className="text-faint">—</span>}</td>
                    <td style={{ color:'var(--text-2)' }}>{r.manual_amount?`₹${parseFloat(r.manual_amount).toFixed(2)}`:<span className="text-faint">—</span>}</td>
                    <td style={{ fontFamily:'var(--font-display)',fontWeight:700,color:'var(--brand)' }}>{fmt(r.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* PARTNERS */}
          {reportType === 'partners' && (
            <table>
              <thead><tr><th>Date</th><th>Partner</th><th>Type</th><th>Amount</th><th>Purpose</th><th>Notes</th></tr></thead>
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
                    <td style={{ color:'var(--text-2)' }}>{r.notes||<span className="text-faint">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Empty */}
      {rows !== null && rows.length === 0 && (
        <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text-3)' }}>
          <FileBarChart2 size={36} style={{ margin:'0 auto 14px', opacity:0.2, display:'block' }} />
          <div style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:700, color:'var(--text-2)', marginBottom:6 }}>No records found</div>
          <div style={{ fontSize:13 }}>Try a different date range or report type</div>
        </div>
      )}

      {/* Pre-search state */}
      {!hasData && !loading && (
        <div style={{ textAlign:'center', padding:'80px 20px', color:'var(--text-3)' }}>
          <FileBarChart2 size={40} style={{ margin:'0 auto 16px', opacity:0.2, display:'block' }} />
          <div style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:700, color:'var(--text-2)', marginBottom:6 }}>Select a report and click Generate</div>
          <div style={{ fontSize:13 }}>Overall Summary gives you P&amp;L, expenses, production and attendance in one view</div>
        </div>
      )}

      <style>{`
        /* P&L banner */
        .pnl-banner {
          display: flex; align-items: center; justify-content: space-between;
          padding: 22px 28px; border-radius: var(--r-lg); border: 1px solid var(--border-2);
          background: var(--surface); flex-wrap: wrap; gap: 20px;
        }
        .pnl-profit { border-top: 3px solid var(--green); }
        .pnl-loss   { border-top: 3px solid var(--red);   }
        .pnl-kpi-row { display: flex; gap: 0; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r-md); overflow: hidden; }
        .pnl-kpi { display: flex; flex-direction: column; gap: 4px; padding: 12px 20px; text-align: center; border-right: 1px solid var(--border); }
        .pnl-kpi:last-child { border-right: none; }

        /* Report grid */
        .report-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }

        /* Report cards */
        .rpt-card { padding: 18px; }
        .rpt-card-hdr { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
        .rpt-icon { width: 34px; height: 34px; border-radius: var(--r-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .rpt-icon-green { background: var(--green-dim); }
        .rpt-icon-red   { background: var(--red-dim);   }
        .rpt-card-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-3); margin-bottom: 3px; }
        .rpt-section { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-3); margin: 10px 0 6px; }
        .rpt-row { display: flex; align-items: center; gap: 10px; padding: 5px 0; border-bottom: 1px solid var(--border); }
        .rpt-row:last-of-type { border-bottom: none; }
        .rpt-row-single { margin-bottom: 4px; }
        .rpt-name { font-size: 12.5px; color: var(--text-2); flex-shrink: 0; max-width: 40%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .rpt-val  { font-size: 12.5px; font-weight: 600; white-space: nowrap; min-width: 70px; text-align: right; }
        .rpt-total { display: flex; align-items: center; justify-content: space-between; padding: 10px 0 0; margin-top: 8px; border-top: 2px solid var(--border); font-size: 13px; font-weight: 600; color: var(--text); }
        .rpt-subtotal { display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--text-3); padding: 4px 0; }
        .rpt-empty { font-size: 12px; color: var(--text-3); padding: 8px 0; }

        :global(.spin) { animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 900px) {
          .report-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 600px) {
          .report-grid { grid-template-columns: 1fr; }
          .pnl-banner { flex-direction: column; align-items: flex-start; }
          .pnl-kpi-row { width: 100%; }
        }
      `}</style>
    </div>
  )
            }
