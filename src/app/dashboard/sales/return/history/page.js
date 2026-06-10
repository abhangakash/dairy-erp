'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  RotateCcw, Calendar, Search,
  Download, Loader2, ChevronDown, ChevronRight, Trash2
} from 'lucide-react'

const fmtDate = d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const fmt     = n => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

const REASON_COLORS = {
  'Defective':           'badge-red',
  'Expired':             'badge-orange',
  'Damaged in Transit':  'badge-yellow',
  'Wrong Product':       'badge-blue',
  'Quality Issue':       'badge-orange',
  'Other':               '',
}

export default function ReturnHistoryPage() {
  const today      = new Date().toISOString().split('T')[0]
  const monthStart = today.slice(0, 8) + '01'

  const [returns, setReturns]               = useState([])
  const [loading, setLoading]               = useState(true)
  const [fromDate, setFromDate]             = useState(monthStart)
  const [toDate, setToDate]                 = useState(today)
  const [distributorFilter, setDistributorFilter] = useState('')
  const [productFilter, setProductFilter]   = useState('')
  const [distributors, setDistributors]     = useState([])
  const [products, setProducts]             = useState([])
  const [expanded, setExpanded]             = useState({})

  useEffect(() => {
    fetchDistributors()
    fetchProducts()
    fetchHistory()
  }, [])

  async function fetchDistributors() {
    const { data } = await supabase
      .from('distributors')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
    setDistributors(data || [])
  }

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
    setProducts(data || [])
  }

  async function fetchHistory() {
    setLoading(true)

    let query = supabase
      .from('product_returns')
      .select(`
        id, entry_date, total_amount, return_reason, notes, expense_id, entered_at,
        distributors(id, name, phone, route),
        product_return_items(
          id, quantity, unit_price, total_amount, reason, notes,
          products(id, name, unit)
        ),
        profiles(full_name)
      `)
      .gte('entry_date', fromDate)
      .lte('entry_date', toDate)
      .order('entry_date', { ascending: false })
      .order('entered_at', { ascending: false })

    if (distributorFilter) query = query.eq('distributor_id', distributorFilter)

    const { data, error } = await query
    if (error) { toast.error('Failed to load'); setLoading(false); return }

    let filtered = data || []

    // Client-side product filter (since it's a join)
    if (productFilter) {
      filtered = filtered.filter(r =>
        r.product_return_items?.some(i => i.products?.id === productFilter)
      )
    }

    setReturns(filtered)
    setLoading(false)
  }

  function toggleExpand(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  async function deleteReturn(id, expenseId) {
    if (!confirm('Delete this return? The linked expense entry will also be deleted.')) return

    await supabase.from('product_return_items').delete().eq('return_id', id)
    if (expenseId) await supabase.from('daily_expenses').delete().eq('id', expenseId)
    const { error } = await supabase.from('product_returns').delete().eq('id', id)

    if (error) toast.error('Failed to delete')
    else { toast.success('Return deleted'); fetchHistory() }
  }

  function exportCSV() {
    if (returns.length === 0) { toast.error('No data to export'); return }
    const rows = []
    returns.forEach(r => {
      r.product_return_items?.forEach(item => {
        rows.push([
          r.entry_date,
          r.distributors?.name || '',
          r.distributors?.route || '',
          item.products?.name || '',
          parseFloat(item.quantity),
          item.products?.unit || '',
          parseFloat(item.unit_price).toFixed(2),
          parseFloat(item.total_amount).toFixed(2),
          item.reason || r.return_reason || '',
          item.notes || r.notes || '',
          r.profiles?.full_name || '',
          new Date(r.entered_at).toLocaleString('en-IN'),
        ])
      })
    })
    const header = ['Date','Distributor','Route','Product','Qty','Unit','Unit Price','Total','Reason','Notes','Entered By','Time']
    const csv = [header, ...rows].map(r =>
      r.map(v => `"${String(v || '').replace(/"/g, "'")}"`) .join(',')
    ).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `returns_${fromDate}_to_${toDate}.csv`
    a.click()
    toast.success('CSV exported')
  }

  // Summary stats
  const totalReturns = returns.length
  const totalAmount  = returns.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0)

  // Product-wise summary
  const productSummary = {}
  returns.forEach(r => {
    r.product_return_items?.forEach(i => {
      const name = i.products?.name || 'Unknown'
      if (!productSummary[name]) productSummary[name] = { qty: 0, amount: 0, unit: i.products?.unit || '' }
      productSummary[name].qty    += parseFloat(i.quantity || 0)
      productSummary[name].amount += parseFloat(i.total_amount || 0)
    })
  })

  // Distributor-wise summary
  const distSummary = {}
  returns.forEach(r => {
    const name = r.distributors?.name || 'Unknown'
    if (!distSummary[name]) distSummary[name] = { count: 0, amount: 0 }
    distSummary[name].count  += 1
    distSummary[name].amount += parseFloat(r.total_amount || 0)
  })

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Return History</div>
          <div className="page-subtitle">
            {totalReturns} returns · {fmt(totalAmount)} total expense
          </div>
        </div>
        <button className="btn btn-ghost" onClick={exportCSV}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div className="filters-row">
          <div className="filter-field">
            <label className="label">From Date</label>
            <div className="date-wrap">
              <Calendar size={13} className="date-icon" />
              <input type="date" className="input date-input" value={fromDate}
                onChange={e => setFromDate(e.target.value)} />
            </div>
          </div>

          <div className="filter-field">
            <label className="label">To Date</label>
            <div className="date-wrap">
              <Calendar size={13} className="date-icon" />
              <input type="date" className="input date-input" value={toDate}
                onChange={e => setToDate(e.target.value)} />
            </div>
          </div>

          <div className="filter-field" style={{ minWidth: 180 }}>
            <label className="label">Distributor</label>
            <select className="input" value={distributorFilter}
              onChange={e => setDistributorFilter(e.target.value)}>
              <option value="">All Distributors</option>
              {distributors.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="filter-field" style={{ minWidth: 180 }}>
            <label className="label">Product</label>
            <select className="input" value={productFilter}
              onChange={e => setProductFilter(e.target.value)}>
              <option value="">All Products</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-end' }}>
            {[
              { l: 'Today',  f: () => { setFromDate(today); setToDate(today) } },
              { l: '7 Days', f: () => { const d = new Date(); d.setDate(d.getDate()-7); setFromDate(d.toISOString().split('T')[0]); setToDate(today) } },
              { l: 'Month',  f: () => { setFromDate(today.slice(0,8)+'01'); setToDate(today) } },
            ].map(q => (
              <button key={q.l} className="btn btn-ghost btn-sm" onClick={q.f}>{q.l}</button>
            ))}
          </div>

          <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }} onClick={fetchHistory}>
            <Search size={14} /> Search
          </button>
        </div>
      </div>

      {/* Summary strip */}
      {!loading && returns.length > 0 && (
        <div className="summary-strip">
          <div className="summary-item">
            <span className="summary-label">Total Returns</span>
            <span className="summary-val">{totalReturns}</span>
          </div>
          <div className="summary-divider" />
          <div className="summary-item">
            <span className="summary-label">Total Expense</span>
            <span className="summary-val text-yellow">{fmt(totalAmount)}</span>
          </div>
          <div className="summary-divider" />
          <div className="summary-item">
            <span className="summary-label">Distributors</span>
            <span className="summary-val">{Object.keys(distSummary).length}</span>
          </div>
          <div className="summary-divider" />
          <div className="summary-item">
            <span className="summary-label">Products Returned</span>
            <span className="summary-val">{Object.keys(productSummary).length}</span>
          </div>
        </div>
      )}

      {/* Breakdown tables */}
      {!loading && returns.length > 0 && (
        <div className="breakdown-grid">
          {/* By Product */}
          <div className="card breakdown-card">
            <div className="breakdown-title">By Product</div>
            {Object.entries(productSummary)
              .sort((a, b) => b[1].amount - a[1].amount)
              .map(([name, d]) => (
                <div key={name} className="breakdown-row">
                  <span className="breakdown-name">{name}</span>
                  <span className="breakdown-sub">{d.qty.toLocaleString('en-IN')} {d.unit}</span>
                  <span className="breakdown-val text-yellow">{fmt(d.amount)}</span>
                </div>
              ))}
          </div>

          {/* By Distributor */}
          <div className="card breakdown-card">
            <div className="breakdown-title">By Distributor</div>
            {Object.entries(distSummary)
              .sort((a, b) => b[1].amount - a[1].amount)
              .map(([name, d]) => (
                <div key={name} className="breakdown-row">
                  <span className="breakdown-name">{name}</span>
                  <span className="breakdown-sub">{d.count} return{d.count !== 1 ? 's' : ''}</span>
                  <span className="breakdown-val text-yellow">{fmt(d.amount)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Returns list */}
      {loading ? (
        <div className="table-loading"><Loader2 size={20} className="spin" /> Loading…</div>
      ) : returns.length === 0 ? (
        <div className="empty-state card">
          <RotateCcw size={32} />
          <p>No returns in this date range</p>
        </div>
      ) : (
        <div className="returns-list">
          {returns.map(ret => {
            const isOpen = expanded[ret.id]
            return (
              <div key={ret.id} className="return-row-card">
                {/* Header row */}
                <div className="return-row-header" onClick={() => toggleExpand(ret.id)}>
                  <div className="return-row-toggle">
                    {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </div>

                  <div className="return-row-date">{fmtDate(ret.entry_date)}</div>

                  <div className="return-row-dist">
                    <span className="dist-name">{ret.distributors?.name}</span>
                    {ret.distributors?.route && (
                      <span className="dist-route">{ret.distributors.route}</span>
                    )}
                  </div>

                  <div className="return-row-items">
                    {ret.product_return_items?.length} item{ret.product_return_items?.length !== 1 ? 's' : ''}
                  </div>

                  <div className="return-row-reason">
                    <span className={`badge ${REASON_COLORS[ret.return_reason] || ''}`}>
                      {ret.return_reason || '—'}
                    </span>
                  </div>

                  <div className="return-row-total">{fmt(ret.total_amount)}</div>

                  <div className="return-row-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-ghost btn-sm delete-row-btn"
                      onClick={() => deleteReturn(ret.id, ret.expense_id)}>
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="return-row-expanded">
                    <table>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Quantity</th>
                          <th>Unit Price</th>
                          <th>Total</th>
                          <th>Reason</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ret.product_return_items?.map(item => (
                          <tr key={item.id}>
                            <td style={{ fontWeight: 500 }}>{item.products?.name}</td>
                            <td>{parseFloat(item.quantity)} {item.products?.unit}</td>
                            <td>₹{parseFloat(item.unit_price).toFixed(2)}</td>
                            <td style={{ color: 'var(--yellow)', fontWeight: 600 }}>
                              {fmt(item.total_amount)}
                            </td>
                            <td>
                              <span className={`badge ${REASON_COLORS[item.reason] || ''}`}>
                                {item.reason || ret.return_reason || '—'}
                              </span>
                            </td>
                            <td style={{ color: 'var(--text-2)', fontSize: 12 }}>
                              {item.notes || <span className="text-faint">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="return-expanded-footer">
                      <span className="text-faint">
                        Entered by: {ret.profiles?.full_name || '—'} ·{' '}
                        {new Date(ret.entered_at).toLocaleString('en-IN')}
                      </span>
                      {ret.notes && <span className="text-muted">Note: {ret.notes}</span>}
                      {ret.expense_id && (
                        <span style={{ fontSize: 11, color: 'var(--green)' }}>
                          ✓ Linked to expense
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <style jsx>{`
        .filters-row { display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap; }
        .filter-field { display: flex; flex-direction: column; gap: 4px; }
        .date-wrap { position: relative; }
        .date-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--text-3); pointer-events: none; }
        .date-input { padding-left: 32px; min-width: 155px; }

        .summary-strip {
          display: flex; align-items: center;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); overflow: hidden; margin-bottom: 20px;
        }
        .summary-item { flex: 1; padding: 16px 20px; text-align: center; }
        .summary-label { display: block; font-size: 11px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
        .summary-val { font-family: var(--font-display); font-size: 20px; font-weight: 700; color: var(--text); }
        .summary-divider { width: 1px; background: var(--border); align-self: stretch; }
        .text-yellow { color: var(--yellow) !important; }

        .breakdown-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 16px; margin-bottom: 20px;
        }
        .breakdown-card { padding: 16px; }
        .breakdown-title {
          font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.08em; color: var(--text-3);
          margin-bottom: 10px; padding-bottom: 8px;
          border-bottom: 1px solid var(--border);
        }
        .breakdown-row {
          display: flex; align-items: center; gap: 10px;
          padding: 6px 0; border-bottom: 1px solid var(--border);
          font-size: 13px;
        }
        .breakdown-row:last-child { border-bottom: none; }
        .breakdown-name { flex: 1; font-weight: 500; }
        .breakdown-sub { font-size: 11px; color: var(--text-3); white-space: nowrap; }
        .breakdown-val { font-weight: 600; white-space: nowrap; min-width: 80px; text-align: right; }

        .table-loading { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 60px; color: var(--text-3); }

        .returns-list { display: flex; flex-direction: column; gap: 8px; }
        .return-row-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-md); overflow: hidden; transition: border-color 0.14s;
        }
        .return-row-card:hover { border-color: var(--border-2); }

        .return-row-header {
          display: grid;
          grid-template-columns: 32px 130px 1fr 80px 150px 120px 110px;
          gap: 12px; align-items: center;
          padding: 14px 16px; cursor: pointer; transition: background 0.12s;
        }
        .return-row-header:hover { background: var(--surface-2); }

        .return-row-toggle { color: var(--text-3); display: flex; }
        .return-row-date { font-size: 13px; font-weight: 500; white-space: nowrap; }
        .return-row-dist { display: flex; flex-direction: column; gap: 2px; }
        .dist-name { font-weight: 600; font-size: 14px; }
        .dist-route { font-size: 11px; color: var(--text-3); }
        .return-row-items { font-size: 12px; color: var(--text-2); }
        .return-row-reason { }
        .return-row-total {
          font-family: var(--font-display); font-size: 16px;
          font-weight: 700; color: var(--yellow);
        }
        .return-row-actions { display: flex; justify-content: flex-end; }
        .delete-row-btn {
          color: var(--red) !important;
          border-color: rgba(239,68,68,0.3) !important;
          font-size: 11px !important; padding: 5px 8px !important;
        }
        .delete-row-btn:hover { background: var(--red-dim) !important; }

        .return-row-expanded {
          border-top: 1px solid var(--border);
          background: var(--surface-2);
        }
        .return-expanded-footer {
          display: flex; justify-content: space-between; align-items: center;
          padding: 10px 16px; font-size: 12px;
          border-top: 1px solid var(--border);
          flex-wrap: wrap; gap: 8px;
        }

        :global(.spin) { animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {

  .page-header {
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .page-header .btn {
    width: 100%;
  }

  .filters-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .filter-field {
    width: 100%;
  }

  .date-input,
  .input {
    width: 100%;
    min-width: 0;
  }

  .summary-strip {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }

  .summary-divider {
    display: none;
  }

  .summary-item {
    border: 1px solid var(--border);
  }

  .breakdown-grid {
    grid-template-columns: 1fr;
  }

  /* MOBILE RETURN CARD */

  .return-row-header {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    padding: 16px;
  }

  .return-row-toggle {
    display: none;
  }

  .return-row-date {
    font-size: 12px;
    color: var(--text-3);
  }

  .return-row-dist {
    gap: 4px;
  }

  .dist-name {
    font-size: 15px;
  }

  .return-row-items {
    font-size: 13px;
    color: var(--text-2);
  }

  .return-row-reason {
    display: flex;
  }

  .return-row-total {
    font-size: 20px;
  }

  .return-row-actions {
    justify-content: stretch;
  }

  .delete-row-btn {
    width: 100%;
  }

  .return-row-expanded {
    overflow-x: auto;
  }

  .return-row-expanded table {
    min-width: 600px;
  }

  .return-expanded-footer {
    flex-direction: column;
    align-items: flex-start;
  }
}
  
      `}</style>
    </div>
  )
}