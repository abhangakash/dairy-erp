'use client'

// src/app/(dashboard)/sales/payment/history/page.js
// Payment collection history — mirrors the sales history UX pattern

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  IndianRupee, Calendar, Search,
  Download, Loader2, ChevronDown, ChevronRight, X
} from 'lucide-react'
import {
  generatePaymentReceiptPDF,
  openPDFAndShareWhatsApp,
  downloadPDF,
  generateInvoiceNo,
} from '@/lib/utils/pdf'
import { shareOrDownloadPDF } from '@/lib/utils/pdf'

const MODE_COLORS = {
  cash:   'badge-green',
  upi:    'badge-blue',
  bank:   'badge-blue',
  cheque: 'badge-yellow',
  other:  '',
}

export default function PaymentHistoryPage() {
  const today      = new Date().toISOString().split('T')[0]
  const monthStart = today.slice(0, 8) + '01'

  const [payments, setPayments]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [fromDate, setFromDate]           = useState(monthStart)
  const [toDate, setToDate]               = useState(today)
  const [distributorFilter, setDistributorFilter] = useState('')
  const [modeFilter, setModeFilter]       = useState('')
  const [distributors, setDistributors]   = useState([])
  const [expanded, setExpanded]           = useState({})

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
      .from('distributor_payments')
      .select(`
        id, entry_date, amount, payment_mode, notes,
        reference_no, entered_at,
        distributors(id, name, phone, route),
        profiles(full_name)
      `)
      .gte('entry_date', fromDate)
      .lte('entry_date', toDate)
      .order('entry_date', { ascending: false })
      .order('entered_at', { ascending: false })

    if (distributorFilter) query = query.eq('distributor_id', distributorFilter)
    if (modeFilter)         query = query.eq('payment_mode', modeFilter)

    const { data, error } = await query
    if (error) toast.error('Failed to load')
    else setPayments(data || [])
    setLoading(false)
  }

  function toggleExpand(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  async function deletePayment(id) {
    if (!confirm('Delete this payment record? This will affect the outstanding balance.')) return
    const { error } = await supabase.from('distributor_payments').delete().eq('id', id)
    if (error) toast.error('Failed to delete')
    else { toast.success('Deleted'); fetchHistory() }
  }

  async function sendReceiptPDF(payment) {
    try {
      const doc = await generatePaymentReceiptPDF({
        receiptNo:   generateInvoiceNo('MF-PR'),
        date:        new Date(payment.entry_date).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'long', year: 'numeric'
        }),
        distributor: payment.distributors,
        amount:      parseFloat(payment.amount),
        paymentMode: payment.payment_mode,
        referenceNo: payment.reference_no,
        notes:       payment.notes,
      })
await shareOrDownloadPDF(doc, `MilkyFeast_Receipt_${payment.distributors?.name}_${payment.entry_date}.pdf`)
      toast.success('PDF opened! WhatsApp opening shortly…')
    } catch (err) {
      toast.error('Failed: ' + err.message)
    }
  }

  async function downloadReceipt(payment) {
    try {
      const doc = await generatePaymentReceiptPDF({
        receiptNo:   generateInvoiceNo('MF-PR'),
        date:        new Date(payment.entry_date).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'long', year: 'numeric'
        }),
        distributor: payment.distributors,
        amount:      parseFloat(payment.amount),
        paymentMode: payment.payment_mode,
        referenceNo: payment.reference_no,
        notes:       payment.notes,
      })
      downloadPDF(
        doc,
        `MilkyFeast_Receipt_${payment.distributors?.name}_${payment.entry_date}.pdf`
      )
      toast.success('Receipt downloaded!')
    } catch (err) {
      toast.error('Failed: ' + err.message)
    }
  }

  function sendWhatsAppMessage(payment) {
    const dist = payment.distributors
    if (!dist?.phone) { toast.error('No phone number for this distributor'); return }
    const msg = encodeURIComponent(
      `Dear ${dist.name},\n\nWe have received your payment of ₹${parseFloat(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })} on ${new Date(payment.entry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} via ${payment.payment_mode?.toUpperCase()}${payment.reference_no ? ` (Ref: ${payment.reference_no})` : ''}.\n\nThank you for your payment!\n— MilkyFeast 🙏`
    )
    const num = dist.phone.replace(/\D/g, '')
    window.open(`https://wa.me/${num.startsWith('91') ? num : '91' + num}?text=${msg}`, '_blank')
  }

  function exportCSV() {
    if (payments.length === 0) { toast.error('No data to export'); return }
    const rows = payments.map(p => [
      p.entry_date,
      p.distributors?.name || '',
      p.distributors?.route || '',
      parseFloat(p.amount).toFixed(2),
      p.payment_mode || '',
      p.reference_no || '',
      p.notes || '',
      p.profiles?.full_name || '',
      new Date(p.entered_at).toLocaleString('en-IN'),
    ])
    const header = ['Date','Distributor','Route','Amount','Mode','Reference','Notes','Entered By','Time']
    const csv    = [header, ...rows].map(r => r.join(',')).join('\n')
    const blob   = new Blob([csv], { type: 'text/csv' })
    const a      = document.createElement('a')
    a.href       = URL.createObjectURL(blob)
    a.download   = `payments_${fromDate}_to_${toDate}.csv`
    a.click()
    toast.success('CSV exported')
  }

  // Summary stats
  const totalAmount   = payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0)
  const totalPayments = payments.length
  const byMode        = payments.reduce((acc, p) => {
    acc[p.payment_mode] = (acc[p.payment_mode] || 0) + parseFloat(p.amount || 0)
    return acc
  }, {})

  const fmt = n => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Payment History</div>
          <div className="page-subtitle">
            {totalPayments} records · {fmt(totalAmount)} collected
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
          <div className="filter-field" style={{ minWidth: 140 }}>
            <label className="label">Mode</label>
            <select className="input" value={modeFilter}
              onChange={e => setModeFilter(e.target.value)}>
              <option value="">All Modes</option>
              {['cash', 'upi', 'bank', 'cheque', 'other'].map(m => (
                <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }} onClick={fetchHistory}>
            <Search size={14} /> Search
          </button>
        </div>
      </div>

      {/* Summary strip */}
      {!loading && payments.length > 0 && (
        <div className="summary-strip">
          <div className="summary-item">
            <span className="summary-label">Total Collected</span>
            <span className="summary-val text-green">{fmt(totalAmount)}</span>
          </div>
          <div className="summary-divider" />
          <div className="summary-item">
            <span className="summary-label">No. of Payments</span>
            <span className="summary-val">{totalPayments}</span>
          </div>
          <div className="summary-divider" />
          <div className="summary-item">
            <span className="summary-label">Cash</span>
            <span className="summary-val">{fmt(byMode.cash || 0)}</span>
          </div>
          <div className="summary-divider" />
          <div className="summary-item">
            <span className="summary-label">UPI / Bank</span>
            <span className="summary-val">{fmt((byMode.upi || 0) + (byMode.bank || 0))}</span>
          </div>
          <div className="summary-divider" />
          <div className="summary-item">
            <span className="summary-label">Cheque</span>
            <span className="summary-val">{fmt(byMode.cheque || 0)}</span>
          </div>
        </div>
      )}

      {/* Payment list */}
      {loading ? (
        <div className="table-loading">
          <Loader2 size={20} className="spin" /> Loading…
        </div>
      ) : payments.length === 0 ? (
        <div className="empty-state card">
          <IndianRupee size={32} />
          <p>No payments in this date range</p>
        </div>
      ) : (
        <div className="payments-list">
          {payments.map(payment => {
            const isOpen = expanded[payment.id]
            return (
              <div key={payment.id} className="payment-row-card">
                {/* Header row */}
                <div className="payment-row-header" onClick={() => toggleExpand(payment.id)}>
                  <div className="row-toggle">
                    {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </div>

                  <div className="row-date">
                    {new Date(payment.entry_date).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </div>

                  <div className="row-dist">
                    <span className="dist-name">{payment.distributors?.name}</span>
                    {payment.distributors?.route && (
                      <span className="dist-route">{payment.distributors.route}</span>
                    )}
                  </div>

                  <div className="row-amount">
                    {fmt(payment.amount)}
                  </div>

                  <div className="row-mode">
                    <span className={`badge ${MODE_COLORS[payment.payment_mode] || ''}`}>
                      {payment.payment_mode}
                    </span>
                  </div>

                  <div className="row-ref">
                    {payment.reference_no
                      ? <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{payment.reference_no}</span>
                      : <span className="text-faint">—</span>
                    }
                  </div>

                  {/* Actions — stop propagation so row expand doesn't fire */}
                  <div className="row-actions" onClick={e => e.stopPropagation()}>
                    {/* WA message button */}
                    <button
                      className="btn btn-ghost btn-sm wa-btn"
                      title="Send WhatsApp message"
                      onClick={() => sendWhatsAppMessage(payment)}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#25d366">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      WA Msg
                    </button>

                    {/* PDF receipt button (share + WA) */}
                    <button
                      className="btn btn-ghost btn-sm pdf-btn"
                      title="Share PDF Receipt via WhatsApp"
                      onClick={() => sendReceiptPDF(payment)}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      PDF
                    </button>

                    {/* Delete */}
                    <button
                      className="del-btn"
                      title="Delete payment"
                      onClick={() => deletePayment(payment.id)}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="payment-expanded">
                    <div className="expanded-grid">
                      <div className="exp-field">
                        <span className="exp-label">Payment Mode</span>
                        <span className="exp-val" style={{ textTransform: 'capitalize' }}>{payment.payment_mode}</span>
                      </div>
                      <div className="exp-field">
                        <span className="exp-label">Reference No.</span>
                        <span className="exp-val">{payment.reference_no || '—'}</span>
                      </div>
                      <div className="exp-field">
                        <span className="exp-label">Notes</span>
                        <span className="exp-val">{payment.notes || '—'}</span>
                      </div>
                      <div className="exp-field">
                        <span className="exp-label">Entered By</span>
                        <span className="exp-val">{payment.profiles?.full_name || '—'}</span>
                      </div>
                      <div className="exp-field">
                        <span className="exp-label">Timestamp</span>
                        <span className="exp-val">{new Date(payment.entered_at).toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    {/* Quick action buttons in expanded view too */}
                    <div className="expanded-actions">
                      <button className="btn btn-ghost btn-sm wa-btn"
                        onClick={() => sendWhatsAppMessage(payment)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="#25d366">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        Send WA Message
                      </button>
                      <button className="btn btn-ghost btn-sm pdf-btn"
                        onClick={() => sendReceiptPDF(payment)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        Share PDF via WhatsApp
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
                        onClick={() => downloadReceipt(payment)}>
                        <Download size={12} /> Download PDF
                      </button>
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
        .summary-val { font-family: var(--font-display); font-size: 18px; font-weight: 700; color: var(--text); }
        .summary-divider { width: 1px; background: var(--border); align-self: stretch; }

        .table-loading { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 60px; color: var(--text-3); }

        .payments-list { display: flex; flex-direction: column; gap: 8px; }

        .payment-row-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-md); overflow: hidden;
          transition: border-color 0.14s;
        }
        .payment-row-card:hover { border-color: var(--border-2); }

        .payment-row-header {
          display: grid;
          grid-template-columns: 32px 130px 1fr 140px 100px 130px 200px;
          gap: 12px; align-items: center;
          padding: 14px 16px; cursor: pointer;
          transition: background 0.12s;
        }
        .payment-row-header:hover { background: var(--surface-2); }

        .row-toggle { color: var(--text-3); display: flex; }
        .row-date { font-size: 13px; font-weight: 500; color: var(--text); white-space: nowrap; }
        .row-dist { display: flex; flex-direction: column; gap: 2px; }
        .dist-name { font-weight: 600; font-size: 14px; }
        .dist-route { font-size: 11px; color: var(--text-3); }
        .row-amount {
          font-family: var(--font-display); font-size: 16px;
          font-weight: 700; color: var(--green);
        }
        .row-mode { }
        .row-ref { }
        .row-actions { display: flex; align-items: center; gap: 6px; justify-content: flex-end; }

        .wa-btn {
          color: #25d366 !important;
          border-color: rgba(37,211,102,0.3) !important;
          font-size: 11px !important; padding: 5px 8px !important;
        }
        .wa-btn:hover { background: rgba(37,211,102,0.08) !important; }

        .pdf-btn {
          color: var(--blue) !important;
          border-color: rgba(37,99,235,0.3) !important;
          font-size: 11px !important; padding: 5px 8px !important;
        }
        .pdf-btn:hover { background: var(--blue-dim) !important; }

        .del-btn {
          width: 28px; height: 28px; border-radius: var(--r-sm);
          background: none; border: 1px solid transparent;
          color: var(--text-3); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.12s;
        }
        .del-btn:hover { background: var(--red-dim); color: var(--red); border-color: rgba(239,68,68,0.3); }

        /* Expanded detail */
        .payment-expanded {
          border-top: 1px solid var(--border);
          background: var(--surface-2);
          padding: 16px;
        }
        .expanded-grid {
          display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 14px;
        }
        .exp-field { display: flex; flex-direction: column; gap: 3px; min-width: 140px; }
        .exp-label { font-size: 10px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.06em; }
        .exp-val { font-size: 13px; font-weight: 500; color: var(--text); }
        .expanded-actions {
          display: flex; gap: 8px; flex-wrap: wrap;
          padding-top: 12px; border-top: 1px solid var(--border);
        }

        :global(.spin) { animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width:768px){

        .page-header{
          flex-direction:column;
          align-items:stretch;
          gap:14px;
        }

        .page-header .btn{
          width:100%;
          justify-content:center;
        }

        .filters-row{
          flex-direction:column;
          align-items:stretch;
        }

        .filter-field{
          width:100%;
        }

        .date-input{
          width:100%;
          min-width:0;
        }

        /* Summary 2 × 2 */
        .summary-strip{
          display:grid;
          grid-template-columns:1fr 1fr;
        }

        .summary-divider{
          display:none;
        }

        .summary-item{
          padding:14px;
          border-right:1px solid var(--border);
          border-bottom:1px solid var(--border);
        }

        .summary-item:nth-child(2n){
          border-right:none;
        }

        /* SAME STYLE AS SALES HISTORY */

        .payment-row-header{
          display:grid;
          grid-template-columns:32px 1fr auto;
          gap:10px;
          padding:14px;
        }

        .row-date,
        .row-mode,
        .row-ref{
          display:none;
        }

        .row-dist{
          min-width:0;
        }

        .row-amount{
          white-space:nowrap;
          font-size:17px;
          text-align:right;
        }

        .row-actions{
          grid-column:1/-1;
          margin-top:8px;
          justify-content:flex-start;
        }

        .payment-expanded{
          padding:14px;
        }

        .expanded-grid{
          display:grid;
          grid-template-columns:1fr;
          gap:12px;
        }

        .expanded-actions{
          flex-direction:column;
        }

        .expanded-actions .btn{
          width:100%;
          justify-content:center;
        }

      }
      `}</style>
    </div>
  )
}