'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  ShoppingCart, Calendar, Search,
  Download, Loader2, Send, ChevronDown, ChevronRight, IndianRupee
} from 'lucide-react'
import { generateSaleBillPDF, shareOrDownloadPDF, generateInvoiceNo } from '@/lib/utils/pdf'

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
    try {
      const items = sale.daily_sale_items?.map(i => ({
        product_name: i.products?.name,
        unit:         i.products?.unit,
        quantity:     parseFloat(i.quantity),
        unit_price:   parseFloat(i.unit_price),
      })) || []

      const todayTotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)

      const doc = await generateSaleBillPDF({
        invoiceNo:           generateInvoiceNo('MF-SL'),
        date:                new Date(sale.entry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
        distributor:         sale.distributors,
        items,
        previousOutstanding: 0,
        totalOutstanding:    todayTotal,
      })

      await shareOrDownloadPDF(
        doc,
        `MilkyFeast_Invoice_${sale.distributors?.name}_${sale.entry_date}.pdf`
      )
      await supabase.from('daily_sales').update({ bill_sent: true }).eq('id', sale.id)
      fetchHistory()
      toast.success('PDF invoice opened! WhatsApp opening shortly…')
    } catch (err) {
      toast.error('Failed: ' + err.message)
    }
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
                        <button className="btn btn-ghost btn-sm wa-btn"
                          onClick={() => {
                            if (!sale.distributors?.phone) { toast.error('No phone number for this distributor'); return }
                            const total = sale.daily_sale_items?.reduce((s,i) => s + parseFloat(i.total_amount||0), 0) || 0
                            const msg = encodeURIComponent(
                              `Dear ${sale.distributors.name},\n\nYour MilkyFeast sale bill dated ${new Date(sale.entry_date).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'})}:\n\n` +
                              (sale.daily_sale_items?.map(i => `• ${i.products?.name}: ${parseFloat(i.quantity)} ${i.products?.unit} × ₹${parseFloat(i.unit_price).toFixed(2)} = ₹${parseFloat(i.total_amount).toFixed(2)}`).join('\n') || '') +
                              `\n\nTotal: ₹${total.toLocaleString('en-IN', {minimumFractionDigits:2})}\n\nPlease clear the payment at the earliest.\nThank you! — MilkyFeast 🙏`
                            )
                            const num = sale.distributors.phone.replace(/\D/g,'')
                            window.open(`https://wa.me/${num.startsWith('91') ? num : '91'+num}?text=${msg}`, '_blank')
                          }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          WA Msg
                        </button>
                        <button className="btn btn-ghost btn-sm pdf-btn"
                          onClick={() => resendBill(sale)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          PDF
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
        .wa-btn { color: #25d366 !important; border-color: rgba(37,211,102,0.3) !important; font-size: 11px !important; padding: 5px 8px !important; }
        .wa-btn:hover { background: rgba(37,211,102,0.08) !important; }
        .pdf-btn { color: var(--blue) !important; border-color: rgba(37,99,235,0.3) !important; font-size: 11px !important; padding: 5px 8px !important; }
        .pdf-btn:hover { background: var(--blue-dim) !important; }

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

        @media (max-width: 900px) {
          .sale-row-header { grid-template-columns: 32px 1fr 100px 90px; }
          .sale-row-date, .sale-row-items, .sale-row-status { display: none; }
        }
      `}</style>
    </div>
  )
}
