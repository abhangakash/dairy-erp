'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  ShoppingCart, Calendar, Search,
  Download, Loader2, Send, ChevronDown, ChevronRight, IndianRupee
} from 'lucide-react'
import { getWhatsAppLink, formatDistributorBill } from '@/lib/utils/whatsapp'

export default function SalesHistoryPage() {
  const today      = new Date().toISOString().split('T')[0]
  const monthStart = today.slice(0, 8) + '01'

  const [sales, setSales]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [fromDate, setFromDate]         = useState(monthStart)
  const [toDate, setToDate]             = useState(today)
  const [distributorFilter, setDistributorFilter] = useState('')
  const [distributors, setDistributors] = useState([])
  const [expanded, setExpanded]         = useState({}) // sale id -> bool

  useEffect(() => {
    fetchDistributors()
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

  async function fetchHistory() {
    setLoading(true)
    let query = supabase
      .from('daily_sales')
      .select(`
        id, entry_date, notes, bill_sent, entered_at,
        distributors(id, name, phone, route),
        daily_sale_items(
          id, quantity, unit_price, total_amount,
          products(name, unit)
        ),
        profiles(full_name)
      `)
      .gte('entry_date', fromDate)
      .lte('entry_date', toDate)
      .order('entry_date', { ascending: false })
      .order('entered_at', { ascending: false })

    if (distributorFilter) query = query.eq('distributor_id', distributorFilter)

    const { data, error } = await query
    if (error) toast.error('Failed to load')
    else setSales(data || [])
    setLoading(false)
  }

  function toggleExpand(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  async function resendBill(sale) {
    if (!sale.distributors?.phone) {
      toast.error('No phone for this distributor'); return
    }
    const total = sale.daily_sale_items?.reduce((s, i) => s + parseFloat(i.total_amount || 0), 0) || 0
    const message = formatDistributorBill({
      distributor: sale.distributors,
      items: sale.daily_sale_items?.map(i => ({
        product_name: i.products?.name,
        unit:         i.products?.unit,
        quantity:     parseFloat(i.quantity),
        unit_price:   parseFloat(i.unit_price),
      })),
      outstanding: { previous: 0, total },
      date: new Date(sale.entry_date).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric'
      }),
    })
    const link = getWhatsAppLink(sale.distributors.phone, message)
    window.open(link, '_blank')
    await supabase.from('daily_sales').update({ bill_sent: true }).eq('id', sale.id)
    fetchHistory()
    toast.success('Bill opened in WhatsApp')
  }

  function exportCSV() {
    if (sales.length === 0) { toast.error('No data to export'); return }
    const rows = []
    sales.forEach(s => {
      s.daily_sale_items?.forEach(item => {
        rows.push([
          s.entry_date,
          s.distributors?.name || '',
          s.distributors?.route || '',
          item.products?.name || '',
          item.quantity,
          item.products?.unit || '',
          item.unit_price,
          item.total_amount,
          s.bill_sent ? 'Yes' : 'No',
          s.profiles?.full_name || '',
          new Date(s.entered_at).toLocaleString('en-IN'),
        ])
      })
    })
    const header = ['Date','Distributor','Route','Product','Qty','Unit','Unit Price','Total','Bill Sent','Entered By','Time']
    const csv = [header, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `sales_${fromDate}_to_${toDate}.csv`
    a.click()
    toast.success('CSV exported')
  }

  // Summary stats
  const totalBilled = sales.reduce((s, sale) =>
    s + (sale.daily_sale_items?.reduce((ss, i) => ss + parseFloat(i.total_amount || 0), 0) || 0), 0)
  const totalBills  = sales.length
  const billSent    = sales.filter(s => s.bill_sent).length

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Sales History</div>
          <div className="page-subtitle">{totalBills} bills · ₹{totalBilled.toLocaleString('en-IN', { minimumFractionDigits: 2 })} billed</div>
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
          <div className="filter-field" style={{ flex: 1, minWidth: 180 }}>
            <label className="label">Distributor</label>
            <select className="input" value={distributorFilter}
              onChange={e => setDistributorFilter(e.target.value)}>
              <option value="">All Distributors</option>
              {distributors.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }} onClick={fetchHistory}>
            <Search size={14} /> Search
          </button>
        </div>
      </div>

      {/* Summary strip */}
      {!loading && sales.length > 0 && (
        <div className="summary-strip">
          <div className="summary-item">
            <span className="summary-label">Total Billed</span>
            <span className="summary-val text-green">₹{totalBilled.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="summary-divider" />
          <div className="summary-item">
            <span className="summary-label">Total Bills</span>
            <span className="summary-val">{totalBills}</span>
          </div>
          <div className="summary-divider" />
          <div className="summary-item">
            <span className="summary-label">Bills Sent</span>
            <span className="summary-val text-green">{billSent}</span>
          </div>
          <div className="summary-divider" />
          <div className="summary-item">
            <span className="summary-label">Pending Send</span>
            <span className="summary-val text-yellow">{totalBills - billSent}</span>
          </div>
        </div>
      )}

      {/* Sales list */}
      {loading ? (
        <div className="table-loading"><Loader2 size={20} className="spin" /> Loading…</div>
      ) : sales.length === 0 ? (
        <div className="empty-state card">
          <ShoppingCart size={32} />
          <p>No sales in this date range</p>
        </div>
      ) : (
        <div className="sales-list">
          {sales.map(sale => {
            const saleTotal = sale.daily_sale_items?.reduce((s, i) => s + parseFloat(i.total_amount || 0), 0) || 0
            const isOpen    = expanded[sale.id]
            return (
              <div key={sale.id} className="sale-row-card">
                {/* Header row */}
                <div className="sale-row-header" onClick={() => toggleExpand(sale.id)}>
                  <div className="sale-row-toggle">
                    {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </div>
                  <div className="sale-row-date">
                    {new Date(sale.entry_date).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </div>
                  <div className="sale-row-dist">
                    <span className="dist-name">{sale.distributors?.name}</span>
                    {sale.distributors?.route && (
                      <span className="dist-route">{sale.distributors.route}</span>
                    )}
                  </div>
                  <div className="sale-row-items">
                    {sale.daily_sale_items?.length} item{sale.daily_sale_items?.length !== 1 ? 's' : ''}
                  </div>
                  <div className="sale-row-total">
                    ₹{saleTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="sale-row-status">
                    {sale.bill_sent
                      ? <span className="badge badge-green">Sent ✓</span>
                      : <span className="badge badge-yellow">Not Sent</span>
                    }
                  </div>
                  <div className="sale-row-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-ghost btn-sm whatsapp-btn"
                      onClick={() => resendBill(sale)}>
                      <Send size={12} />
                      {sale.bill_sent ? 'Resend' : 'Send Bill'}
                    </button>
                  </div>
                </div>

                {/* Expanded items */}
                {isOpen && (
                  <div className="sale-row-items-expanded">
                    <table>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Quantity</th>
                          <th>Unit Price</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sale.daily_sale_items?.map(item => (
                          <tr key={item.id}>
                            <td style={{ fontWeight: 500 }}>{item.products?.name}</td>
                            <td>{parseFloat(item.quantity)} {item.products?.unit}</td>
                            <td>₹{parseFloat(item.unit_price).toFixed(2)}</td>
                            <td style={{ color: 'var(--green)', fontWeight: 600 }}>
                              ₹{parseFloat(item.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="sale-expanded-footer">
                      <span className="text-faint">
                        Entered by: {sale.profiles?.full_name || '—'} ·{' '}
                        {new Date(sale.entered_at).toLocaleString('en-IN')}
                      </span>
                      {sale.notes && <span className="text-muted">Note: {sale.notes}</span>}
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
          display: flex; align-items: center; gap: 0;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); overflow: hidden; margin-bottom: 20px;
        }
        .summary-item { flex: 1; padding: 16px 20px; text-align: center; }
        .summary-label { display: block; font-size: 11px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
        .summary-val { font-family: var(--font-display); font-size: 20px; font-weight: 700; color: var(--text); }
        .summary-divider { width: 1px; background: var(--border); align-self: stretch; }

        .table-loading { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 60px; color: var(--text-3); }

        .sales-list { display: flex; flex-direction: column; gap: 8px; }
        .sale-row-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-md); overflow: hidden;
          transition: border-color 0.14s;
        }
        .sale-row-card:hover { border-color: var(--border-2); }

        .sale-row-header {
          display: grid;
          grid-template-columns: 32px 130px 1fr 80px 130px 100px 120px;
          gap: 12px; align-items: center;
          padding: 14px 16px; cursor: pointer;
          transition: background 0.12s;
        }
        .sale-row-header:hover { background: var(--surface-2); }

        .sale-row-toggle { color: var(--text-3); display: flex; }
        .sale-row-date { font-size: 13px; font-weight: 500; color: var(--text); white-space: nowrap; }
        .sale-row-dist { display: flex; flex-direction: column; gap: 2px; }
        .dist-name { font-weight: 600; font-size: 14px; }
        .dist-route { font-size: 11px; color: var(--text-3); }
        .sale-row-items { font-size: 12px; color: var(--text-2); }
        .sale-row-total { font-family: var(--font-display); font-size: 16px; font-weight: 700; color: var(--green); }
        .sale-row-status { }
        .sale-row-actions { display: flex; justify-content: flex-end; }
        .whatsapp-btn { color: #25d366 !important; border-color: rgba(37,211,102,0.3) !important; }
        .whatsapp-btn:hover { background: rgba(37,211,102,0.1) !important; }

        .sale-row-items-expanded {
          border-top: 1px solid var(--border);
          background: var(--surface-2);
        }
        .sale-expanded-footer {
          display: flex; justify-content: space-between; align-items: center;
          padding: 10px 16px; font-size: 12px;
          border-top: 1px solid var(--border);
          flex-wrap: wrap; gap: 8px;
        }

        :global(.spin) { animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 1200px) {

  .summary-strip {
    flex-wrap: wrap;
  }

  .summary-item {
    min-width: 50%;
  }
}

@media (max-width: 900px) {

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }

  .page-header .btn {
    width: 100%;
    justify-content: center;
  }

  .filters-row {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .filter-field {
    width: 100%;
  }

  .date-input,
  .filter-field .input {
    width: 100%;
    min-width: 0;
  }

  .filters-row .btn {
    width: 100%;
    justify-content: center;
  }

  .summary-strip {
    flex-direction: column;
  }

  .summary-divider {
    width: 100%;
    height: 1px;
  }

  .summary-item {
    width: 100%;
    min-width: 100%;
  }

  .sale-row-header {
    grid-template-columns: 32px 1fr auto;
    gap: 10px;
    align-items: flex-start;
  }

  .sale-row-date,
  .sale-row-items,
  .sale-row-status {
    display: none;
  }

  .sale-row-total {
    font-size: 14px;
    white-space: nowrap;
  }

  .sale-row-actions {
    grid-column: 1 / -1;
    width: 100%;
    justify-content: stretch;
  }

  .sale-row-actions .btn {
    width: 100%;
    justify-content: center;
  }

  .sale-row-items-expanded {
    overflow-x: auto;
  }

  .sale-row-items-expanded table {
    min-width: 520px;
  }

  .sale-expanded-footer {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 640px) {

  .page-title {
    font-size: 20px;
  }

  .page-subtitle {
    font-size: 13px;
  }

  .summary-val {
    font-size: 18px;
  }

  .sale-row-header {
    padding: 12px;
  }

  .dist-name {
    font-size: 13px;
  }

  .sale-row-total {
    font-size: 13px;
  }

  .sale-row-items-expanded table {
    font-size: 12px;
  }

  .sale-row-items-expanded th,
  .sale-row-items-expanded td {
    padding: 10px 12px;
    white-space: nowrap;
  }
}
      `}</style>
    </div>
  )
}