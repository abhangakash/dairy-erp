'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  FileBarChart2, Calendar, Search, Download,
  Loader2, FlaskConical, ShoppingCart, Users,
  Receipt, Package, Truck, HandCoins, ChevronDown, ChevronRight
} from 'lucide-react'

const REPORT_TYPES = [
  { value: 'production',   label: 'Production',        icon: FlaskConical },
  { value: 'sales',        label: 'Sales',             icon: ShoppingCart },
  { value: 'workers',      label: 'Worker Attendance', icon: Users },
  { value: 'salary',       label: 'Salary Payments',   icon: Users },
  { value: 'expenses',     label: 'Daily Expenses',    icon: Receipt },
  { value: 'raw_material', label: 'Raw Materials',     icon: Package },
  { value: 'vehicles',     label: 'Vehicle Expenses',  icon: Truck },
  { value: 'partners',     label: 'Partner Transactions', icon: HandCoins },
]

export default function ReportsPage() {
  const today      = new Date().toISOString().split('T')[0]
  const monthStart = today.slice(0, 8) + '01'

  const [fromDate, setFromDate]     = useState(monthStart)
  const [toDate, setToDate]         = useState(today)
  const [reportType, setReportType] = useState('sales')
  const [loading, setLoading]       = useState(false)
  const [data, setData]             = useState(null)
  const [expanded, setExpanded]     = useState({})

  async function fetchReport() {
    setLoading(true)
    setData(null)

    try {
      let result = null

      if (reportType === 'production') {
        const { data: rows } = await supabase
          .from('daily_production')
          .select('id, entry_date, batch_no, quantity, notes, entered_at, products(name, unit, category), profiles(full_name)')
          .gte('entry_date', fromDate).lte('entry_date', toDate)
          .order('entry_date', { ascending: false })
        result = rows || []
      }

      else if (reportType === 'sales') {
        const { data: rows } = await supabase
          .from('daily_sales')
          .select('id, entry_date, bill_sent, entered_at, notes, distributors(name, phone, route), daily_sale_items(quantity, unit_price, total_amount, products(name, unit)), profiles(full_name)')
          .gte('entry_date', fromDate).lte('entry_date', toDate)
          .order('entry_date', { ascending: false })
        result = rows || []
      }

      else if (reportType === 'workers') {
        const { data: rows } = await supabase
          .from('worker_attendance')
          .select('id, entry_date, status, notes, entered_at, workers(name, role), profiles(full_name)')
          .gte('entry_date', fromDate).lte('entry_date', toDate)
          .order('entry_date', { ascending: false })
        result = rows || []
      }

      else if (reportType === 'salary') {
        const { data: rows } = await supabase
          .from('salary_payments')
          .select('id, month, working_days, gross_amount, paid_amount, remaining, payment_status, paid_date, entered_at, workers(name, role, salary_type), profiles(full_name)')
          .order('month', { ascending: false })
        result = rows || []
      }

      else if (reportType === 'expenses') {
        const { data: rows } = await supabase
          .from('daily_expenses')
          .select('id, entry_date, amount, notes, entered_at, expense_categories(name), profiles(full_name)')
          .gte('entry_date', fromDate).lte('entry_date', toDate)
          .order('entry_date', { ascending: false })
        result = rows || []
      }

      else if (reportType === 'raw_material') {
        const { data: rows } = await supabase
          .from('raw_material_stock_entries')
          .select('id, entry_date, quantity, unit_price, supplier, entered_at, raw_materials(name, unit), profiles(full_name)')
          .gte('entry_date', fromDate).lte('entry_date', toDate)
          .order('entry_date', { ascending: false })
        result = rows || []
      }

      else if (reportType === 'vehicles') {
        const { data: rows } = await supabase
          .from('vehicle_expenses')
          .select('id, entry_date, expense_type, distance_km, rate_per_km, auto_amount, manual_amount, total_amount, notes, entered_at, vehicles(name, fuel_type), distributors(name), profiles(full_name)')
          .gte('entry_date', fromDate).lte('entry_date', toDate)
          .order('entry_date', { ascending: false })
        result = rows || []
      }

      else if (reportType === 'partners') {
        const { data: rows } = await supabase
          .from('partner_transactions')
          .select('id, entry_date, transaction_type, amount, purpose, notes, entered_at, partners(name), profiles(full_name)')
          .gte('entry_date', fromDate).lte('entry_date', toDate)
          .order('entry_date', { ascending: false })
        result = rows || []
      }

      setData(result)
      if (result.length === 0) toast('No records found for this period', { icon: '📭' })
      else toast.success(`${result.length} records loaded`)

    } catch (err) {
      toast.error('Failed to load report')
    }

    setLoading(false)
  }

  // ── CSV Export ────────────────────────────────────────────
  function exportCSV() {
    if (!data || data.length === 0) { toast.error('No data to export'); return }

    let headers = [], rows = []

    if (reportType === 'production') {
      headers = ['Date', 'Product', 'Category', 'Unit', 'Batch', 'Quantity', 'Notes', 'Entered By', 'Time']
      rows = data.map(r => [r.entry_date, r.products?.name, r.products?.category || '', r.products?.unit, r.batch_no, r.quantity, r.notes || '', r.profiles?.full_name || '', new Date(r.entered_at).toLocaleString('en-IN')])
    }
    else if (reportType === 'sales') {
      headers = ['Date', 'Distributor', 'Route', 'Product', 'Qty', 'Unit', 'Unit Price', 'Total', 'Bill Sent', 'Entered By']
      rows = []
      data.forEach(s => {
        s.daily_sale_items?.forEach(item => {
          rows.push([s.entry_date, s.distributors?.name, s.distributors?.route || '', item.products?.name, item.quantity, item.products?.unit, item.unit_price, item.total_amount, s.bill_sent ? 'Yes' : 'No', s.profiles?.full_name || ''])
        })
      })
    }
    else if (reportType === 'workers') {
      headers = ['Date', 'Worker', 'Role', 'Status', 'Notes', 'Entered By']
      rows = data.map(r => [r.entry_date, r.workers?.name, r.workers?.role || '', r.status, r.notes || '', r.profiles?.full_name || ''])
    }
    else if (reportType === 'salary') {
      headers = ['Month', 'Worker', 'Role', 'Type', 'Working Days', 'Gross', 'Paid', 'Remaining', 'Status']
      rows = data.map(r => [r.month, r.workers?.name, r.workers?.role || '', r.workers?.salary_type, r.working_days || '', r.gross_amount, r.paid_amount, r.remaining, r.payment_status])
    }
    else if (reportType === 'expenses') {
      headers = ['Date', 'Category', 'Amount', 'Notes', 'Entered By']
      rows = data.map(r => [r.entry_date, r.expense_categories?.name || '', r.amount, r.notes || '', r.profiles?.full_name || ''])
    }
    else if (reportType === 'raw_material') {
      headers = ['Date', 'Material', 'Unit', 'Quantity', 'Unit Price', 'Total', 'Supplier', 'Entered By']
      rows = data.map(r => [r.entry_date, r.raw_materials?.name, r.raw_materials?.unit, r.quantity, r.unit_price || '', r.unit_price ? (r.quantity * r.unit_price).toFixed(2) : '', r.supplier || '', r.profiles?.full_name || ''])
    }
    else if (reportType === 'vehicles') {
      headers = ['Date', 'Vehicle', 'Type', 'Distributor', 'Distance KM', 'Rate/KM', 'Auto Amount', 'Manual Amount', 'Total', 'Notes', 'Entered By']
      rows = data.map(r => [r.entry_date, r.vehicles?.name, r.expense_type, r.distributors?.name || '', r.distance_km || '', r.rate_per_km || '', r.auto_amount || '', r.manual_amount || '', r.total_amount, r.notes || '', r.profiles?.full_name || ''])
    }
    else if (reportType === 'partners') {
      headers = ['Date', 'Partner', 'Type', 'Amount', 'Purpose', 'Notes', 'Entered By']
      rows = data.map(r => [r.entry_date, r.partners?.name, r.transaction_type, r.amount, r.purpose || '', r.notes || '', r.profiles?.full_name || ''])
    }

    const csv  = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = `${reportType}_report_${fromDate}_to_${toDate}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success('CSV exported')
  }

  // ── Summary totals ────────────────────────────────────────
  function getSummary() {
    if (!data || data.length === 0) return null
    if (reportType === 'sales') {
      const total = data.reduce((s, sale) =>
        s + (sale.daily_sale_items || []).reduce((ss, i) => ss + parseFloat(i.total_amount || 0), 0), 0)
      return [{ label: 'Total Bills', value: data.length }, { label: 'Total Billed', value: `₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` }, { label: 'Bills Sent', value: data.filter(s => s.bill_sent).length }]
    }
    if (reportType === 'production') {
      const total = data.reduce((s, r) => s + parseFloat(r.quantity || 0), 0)
      return [{ label: 'Total Batches', value: data.length }, { label: 'Total Quantity', value: total.toLocaleString('en-IN') }]
    }
    if (reportType === 'expenses') {
      const total = data.reduce((s, r) => s + parseFloat(r.amount || 0), 0)
      return [{ label: 'Total Entries', value: data.length }, { label: 'Total Amount', value: `₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` }]
    }
    if (reportType === 'vehicles') {
      const total = data.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0)
      return [{ label: 'Total Entries', value: data.length }, { label: 'Total Cost', value: `₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` }]
    }
    if (reportType === 'partners') {
      const given = data.filter(r => ['given', 'loan_given'].includes(r.transaction_type)).reduce((s, r) => s + parseFloat(r.amount || 0), 0)
      const taken = data.filter(r => ['taken', 'loan_taken', 'loan_repaid'].includes(r.transaction_type)).reduce((s, r) => s + parseFloat(r.amount || 0), 0)
      return [{ label: 'Total Entries', value: data.length }, { label: 'Total Given', value: `₹${given.toLocaleString('en-IN')}` }, { label: 'Total Taken', value: `₹${taken.toLocaleString('en-IN')}` }]
    }
    return [{ label: 'Total Records', value: data.length }]
  }

  const summary  = getSummary()
  const selType  = REPORT_TYPES.find(r => r.value === reportType)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Reports</div>
          <div className="page-subtitle">Generate date-range reports for any module</div>
        </div>
        {data && data.length > 0 && (
          <button className="btn btn-ghost" onClick={exportCSV}>
            <Download size={14} /> Export CSV
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div className="filter-row">
          {/* Report type */}
          <div className="filter-field" style={{ minWidth: 200 }}>
            <label className="label">Report Type</label>
            <select className="input" value={reportType}
              onChange={e => { setReportType(e.target.value); setData(null) }}>
              {REPORT_TYPES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Date range — hide for salary */}
          {reportType !== 'salary' && (
            <>
              <div className="filter-field">
                <label className="label">From Date</label>
                <div className="date-wrap">
                  <Calendar size={13} className="date-icon" />
                  <input type="date" className="input date-input"
                    value={fromDate} onChange={e => setFromDate(e.target.value)} />
                </div>
              </div>
              <div className="filter-field">
                <label className="label">To Date</label>
                <div className="date-wrap">
                  <Calendar size={13} className="date-icon" />
                  <input type="date" className="input date-input"
                    value={toDate} onChange={e => setToDate(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* Quick range buttons */}
          <div className="filter-field" style={{ alignSelf: 'flex-end' }}>
            <div className="quick-range">
              {[
                { label: 'Today',     days: 0 },
                { label: '7 Days',    days: 7 },
                { label: 'This Month', days: -1 },
              ].map(q => (
                <button key={q.label} className="btn btn-ghost btn-sm"
                  onClick={() => {
                    const t = new Date().toISOString().split('T')[0]
                    if (q.days === -1) { setFromDate(t.slice(0, 8) + '01'); setToDate(t) }
                    else if (q.days === 0) { setFromDate(t); setToDate(t) }
                    else {
                      const f = new Date(); f.setDate(f.getDate() - q.days)
                      setFromDate(f.toISOString().split('T')[0]); setToDate(t)
                    }
                  }}>
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }}
            onClick={fetchReport} disabled={loading}>
            {loading
              ? <><Loader2 size={14} className="spin" /> Loading…</>
              : <><Search size={14} /> Generate Report</>
            }
          </button>
        </div>
      </div>

      {/* Summary strip */}
      {summary && (
        <div className="summary-strip">
          <div className="summary-label">
            {selType && <selType.icon size={13} />}
            {selType?.label} Summary
          </div>
          {summary.map(s => (
            <div key={s.label} className="summary-item">
              <span className="summary-item-label">{s.label}</span>
              <span className="summary-item-val">{s.value}</span>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={exportCSV}>
            <Download size={13} /> Export CSV
          </button>
        </div>
      )}

      {/* Report tables */}
      {data && data.length > 0 && (
        <div className="table-wrap">

          {/* ── PRODUCTION ── */}
          {reportType === 'production' && (
            <table>
              <thead><tr><th>Date</th><th>Product</th><th>Category</th><th>Batch</th><th>Quantity</th><th>Notes</th><th>Entered By</th><th>Time</th></tr></thead>
              <tbody>
                {data.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{new Date(r.entry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td style={{ fontWeight: 500 }}>{r.products?.name}</td>
                    <td>{r.products?.category ? <span className="badge badge-blue">{r.products.category}</span> : <span className="text-faint">—</span>}</td>
                    <td><span className="badge badge-orange">Batch {r.batch_no}</span></td>
                    <td><span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--green)' }}>{parseFloat(r.quantity).toLocaleString('en-IN')}</span> <span className="text-faint">{r.products?.unit}</span></td>
                    <td style={{ color: 'var(--text-2)' }}>{r.notes || <span className="text-faint">—</span>}</td>
                    <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{r.profiles?.full_name || '—'}</td>
                    <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{new Date(r.entered_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* ── SALES ── */}
          {reportType === 'sales' && (
            <table>
              <thead><tr><th>Date</th><th>Distributor</th><th>Route</th><th>Items</th><th>Total</th><th>Bill Sent</th><th>Entered By</th></tr></thead>
              <tbody>
                {data.map(sale => {
                  const total = (sale.daily_sale_items || []).reduce((s, i) => s + parseFloat(i.total_amount || 0), 0)
                  const isOpen = expanded[sale.id]
                  return [
                    <tr key={sale.id} className="sale-parent-row" onClick={() => setExpanded(p => ({ ...p, [sale.id]: !p[sale.id] }))}>
                      <td style={{ fontWeight: 500 }}>{new Date(sale.entry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td style={{ fontWeight: 600 }}>{sale.distributors?.name}</td>
                      <td style={{ color: 'var(--text-2)' }}>{sale.distributors?.route || <span className="text-faint">—</span>}</td>
                      <td><span className="badge badge-blue">{sale.daily_sale_items?.length} items</span></td>
                      <td><span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--green)' }}>₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></td>
                      <td><span className={`badge ${sale.bill_sent ? 'badge-green' : 'badge-yellow'}`}>{sale.bill_sent ? 'Sent ✓' : 'Pending'}</span></td>
                      <td style={{ color: 'var(--text-2)', fontSize: 13 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          {sale.profiles?.full_name || '—'}
                        </span>
                      </td>
                    </tr>,
                    isOpen && sale.daily_sale_items?.map(item => (
                      <tr key={item.id} className="sale-child-row">
                        <td colSpan={2}></td>
                        <td style={{ color: 'var(--text-2)', paddingLeft: 20 }}>↳ {item.products?.name}</td>
                        <td style={{ color: 'var(--text-2)' }}>{parseFloat(item.quantity)} {item.products?.unit}</td>
                        <td style={{ color: 'var(--text-2)' }}>₹{parseFloat(item.unit_price).toFixed(2)}/unit</td>
                        <td style={{ color: 'var(--green)', fontWeight: 600 }}>₹{parseFloat(item.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td></td>
                      </tr>
                    ))
                  ]
                })}
              </tbody>
            </table>
          )}

          {/* ── ATTENDANCE ── */}
          {reportType === 'workers' && (
            <table>
              <thead><tr><th>Date</th><th>Worker</th><th>Role</th><th>Status</th><th>Notes</th><th>Entered By</th></tr></thead>
              <tbody>
                {data.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{new Date(r.entry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td style={{ fontWeight: 500 }}>{r.workers?.name}</td>
                    <td>{r.workers?.role ? <span className="badge badge-blue">{r.workers.role}</span> : <span className="text-faint">—</span>}</td>
                    <td>
                      <span className={`badge ${r.status === 'present' ? 'badge-green' : r.status === 'absent' ? 'badge-red' : r.status === 'half_day' ? 'badge-yellow' : 'badge-orange'}`}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>{r.notes || <span className="text-faint">—</span>}</td>
                    <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{r.profiles?.full_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* ── SALARY ── */}
          {reportType === 'salary' && (
            <table>
              <thead><tr><th>Month</th><th>Worker</th><th>Type</th><th>Working Days</th><th>Gross</th><th>Paid</th><th>Remaining</th><th>Status</th></tr></thead>
              <tbody>
                {data.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{r.month}</td>
                    <td style={{ fontWeight: 500 }}>{r.workers?.name}</td>
                    <td><span className={`badge ${r.workers?.salary_type === 'fixed' ? 'badge-yellow' : 'badge-orange'}`}>{r.workers?.salary_type === 'fixed' ? 'Fixed' : 'Daily'}</span></td>
                    <td style={{ color: 'var(--text-2)' }}>{r.working_days ?? <span className="text-faint">—</span>}</td>
                    <td style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>₹{parseFloat(r.gross_amount).toLocaleString('en-IN')}</td>
                    <td style={{ color: 'var(--green)', fontWeight: 600 }}>₹{parseFloat(r.paid_amount).toLocaleString('en-IN')}</td>
                    <td style={{ color: parseFloat(r.remaining) > 0 ? 'var(--yellow)' : 'var(--green)', fontWeight: 600 }}>₹{parseFloat(r.remaining).toLocaleString('en-IN')}</td>
                    <td><span className={`badge ${r.payment_status === 'paid' ? 'badge-green' : r.payment_status === 'partial' ? 'badge-yellow' : 'badge-red'}`}>{r.payment_status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* ── EXPENSES ── */}
          {reportType === 'expenses' && (
            <table>
              <thead><tr><th>Date</th><th>Category</th><th>Amount</th><th>Notes</th><th>Entered By</th><th>Time</th></tr></thead>
              <tbody>
                {data.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{new Date(r.entry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td><span className="badge badge-orange">{r.expense_categories?.name || '—'}</span></td>
                    <td style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--brand)' }}>₹{parseFloat(r.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style={{ color: 'var(--text-2)' }}>{r.notes || <span className="text-faint">—</span>}</td>
                    <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{r.profiles?.full_name || '—'}</td>
                    <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{new Date(r.entered_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* ── RAW MATERIAL ── */}
          {reportType === 'raw_material' && (
            <table>
              <thead><tr><th>Date</th><th>Material</th><th>Unit</th><th>Quantity</th><th>Unit Price</th><th>Total</th><th>Supplier</th><th>Entered By</th></tr></thead>
              <tbody>
                {data.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{new Date(r.entry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td style={{ fontWeight: 500 }}>{r.raw_materials?.name}</td>
                    <td><span className="badge badge-orange">{r.raw_materials?.unit}</span></td>
                    <td style={{ color: 'var(--green)', fontWeight: 600 }}>+{parseFloat(r.quantity).toLocaleString('en-IN')}</td>
                    <td style={{ color: 'var(--text-2)' }}>{r.unit_price ? `₹${parseFloat(r.unit_price).toFixed(2)}` : <span className="text-faint">—</span>}</td>
                    <td style={{ fontWeight: 600 }}>{r.unit_price ? `₹${(r.quantity * r.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : <span className="text-faint">—</span>}</td>
                    <td style={{ color: 'var(--text-2)' }}>{r.supplier || <span className="text-faint">—</span>}</td>
                    <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{r.profiles?.full_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* ── VEHICLES ── */}
          {reportType === 'vehicles' && (
            <table>
              <thead><tr><th>Date</th><th>Vehicle</th><th>Type</th><th>Distributor</th><th>Distance</th><th>Auto Amt</th><th>Manual Amt</th><th>Total</th><th>Entered By</th></tr></thead>
              <tbody>
                {data.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{new Date(r.entry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td style={{ fontWeight: 500 }}>{r.vehicles?.name}</td>
                    <td><span className="badge badge-blue">{r.expense_type}</span></td>
                    <td style={{ color: 'var(--text-2)' }}>{r.distributors?.name || <span className="text-faint">—</span>}</td>
                    <td style={{ color: 'var(--text-2)' }}>{r.distance_km ? `${r.distance_km} km` : <span className="text-faint">—</span>}</td>
                    <td style={{ color: 'var(--text-2)' }}>{r.auto_amount ? `₹${parseFloat(r.auto_amount).toFixed(2)}` : <span className="text-faint">—</span>}</td>
                    <td style={{ color: 'var(--text-2)' }}>{r.manual_amount ? `₹${parseFloat(r.manual_amount).toFixed(2)}` : <span className="text-faint">—</span>}</td>
                    <td style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--brand)' }}>₹{parseFloat(r.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{r.profiles?.full_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* ── PARTNERS ── */}
          {reportType === 'partners' && (
            <table>
              <thead><tr><th>Date</th><th>Partner</th><th>Type</th><th>Amount</th><th>Purpose</th><th>Notes</th><th>Entered By</th></tr></thead>
              <tbody>
                {data.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{new Date(r.entry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td style={{ fontWeight: 500 }}>{r.partners?.name}</td>
                    <td><span className="badge badge-blue">{r.transaction_type.replace('_', ' ')}</span></td>
                    <td style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: ['given','loan_given'].includes(r.transaction_type) ? 'var(--red)' : 'var(--green)' }}>
                      {['given','loan_given'].includes(r.transaction_type) ? '-' : '+'}₹{parseFloat(r.amount).toLocaleString('en-IN')}
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>{r.purpose || <span className="text-faint">—</span>}</td>
                    <td style={{ color: 'var(--text-2)' }}>{r.notes || <span className="text-faint">—</span>}</td>
                    <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{r.profiles?.full_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

        </div>
      )}

      {/* Empty state before search */}
      {!data && !loading && (
        <div className="pre-search-state">
          <FileBarChart2 size={40} />
          <div className="pre-search-title">Select a report type and date range</div>
          <div className="pre-search-sub">Then click Generate Report to view results</div>
        </div>
      )}

      <style jsx>{`
        .filter-row { display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap; }
        .filter-field { display: flex; flex-direction: column; gap: 4px; }
        .date-wrap { position: relative; }
        .date-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--text-3); pointer-events: none; }
        .date-input { padding-left: 32px; min-width: 155px; }
        .quick-range { display: flex; gap: 6px; }

        .summary-strip {
          display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-md); padding: 14px 18px; margin-bottom: 16px;
        }
        .summary-label {
          display: flex; align-items: center; gap: 6px;
          font-size: 11px; font-weight: 700; color: var(--text-3);
          text-transform: uppercase; letter-spacing: 0.07em;
        }
        .summary-item { display: flex; flex-direction: column; gap: 2px; }
        .summary-item-label { font-size: 10px; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.06em; }
        .summary-item-val { font-family: var(--font-display); font-size: 17px; font-weight: 700; color: var(--text); }

        .sale-parent-row { cursor: pointer; }
        .sale-parent-row:hover { background: var(--surface-2); }
        .sale-child-row { background: var(--surface-2); }
        .sale-child-row td { padding-top: 6px !important; padding-bottom: 6px !important; font-size: 13px; }

        .pre-search-state {
          text-align: center; padding: 80px 20px;
          color: var(--text-3);
        }
        .pre-search-state :global(svg) { margin: 0 auto 16px; opacity: 0.2; display: block; }
        .pre-search-title { font-family: var(--font-display); font-size: 18px; font-weight: 700; color: var(--text-2); margin-bottom: 6px; }
        .pre-search-sub { font-size: 13px; }

        :global(.spin) { animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 1100px) {

  .filter-row {
    grid-template-columns: repeat(2, 1fr);
  }

  .summary-strip {
    flex-wrap: wrap;
  }
}

@media (max-width: 768px) {

  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
  }

  .page-header .btn {
    width: 100%;
    justify-content: center;
  }

  .filter-row {
    grid-template-columns: 1fr;
  }

  .filter-field {
    min-width: 100% !important;
  }

  .quick-range {
    flex-wrap: wrap;
  }

  .summary-strip {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .summary-item {
    width: 100%;
  }

  .table-wrap {
    overflow-x: auto;
  }

  table {
    min-width: 900px;
  }
}

@media (max-width: 520px) {

  .page-title {
    font-size: 20px;
  }

  .page-subtitle {
    font-size: 13px;
  }

  .summary-item-val {
    font-size: 15px;
  }

  .summary-label {
    font-size: 12px;
  }
}
      `}</style>
    </div>
  )
}