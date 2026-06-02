'use client'

// src/app/(dashboard)/sales/payment/page.js
// CHANGES vs original:
//  1. generatePaymentReceiptPDF now imported directly (no dynamic import)
//  2. PDF button calls sendReceiptPDF() — same 2-button pattern as sales
//  3. "View Payment History" link added in header

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import Link from 'next/link'
import {
  IndianRupee, Save, Loader2, Calendar,
  Search, X, CheckCircle2,
  ChevronDown, ChevronRight, History
} from 'lucide-react'
import {
  generatePaymentReceiptPDF,
  openPDFAndShareWhatsApp,
  downloadPDF,
  generateInvoiceNo,
} from '@/lib/utils/pdf'

const PAYMENT_MODES = ['cash', 'upi', 'bank', 'cheque', 'other']

export default function PaymentCollectionPage() {
  const [distributors, setDistributors] = useState([])
  const [ledger, setLedger]             = useState([])
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [date, setDate]                 = useState(new Date().toISOString().split('T')[0])

  const [selectedDist, setSelectedDist] = useState('')
  const [amount, setAmount]             = useState('')
  const [mode, setMode]                 = useState('cash')
  const [notes, setNotes]               = useState('')
  const [reference, setReference]       = useState('')

  const [recentPayments, setRecentPayments] = useState([])
  const [expandedDist, setExpandedDist]     = useState(null)

  useEffect(() => {
    fetchLedger()
    fetchRecentPayments()
  }, [])

  async function fetchLedger() {
    setLoading(true)
    const { data: dists } = await supabase
      .from('distributors')
      .select('id, name, phone, route')
      .eq('is_active', true)
      .order('name')

    if (!dists || dists.length === 0) {
      setDistributors([]); setLedger([]); setLoading(false); return
    }
    setDistributors(dists)

    const { data: billed } = await supabase
      .from('daily_sales')
      .select('distributor_id, daily_sale_items(total_amount)')
    const billedMap = {}
    ;(billed || []).forEach(sale => {
      const total = (sale.daily_sale_items || []).reduce((s, i) => s + parseFloat(i.total_amount || 0), 0)
      billedMap[sale.distributor_id] = (billedMap[sale.distributor_id] || 0) + total
    })

    const { data: collected } = await supabase
      .from('distributor_payments')
      .select('distributor_id, amount')
    const collectedMap = {}
    ;(collected || []).forEach(p => {
      collectedMap[p.distributor_id] = (collectedMap[p.distributor_id] || 0) + parseFloat(p.amount || 0)
    })

    const ledgerData = dists.map(d => ({
      ...d,
      totalBilled:    billedMap[d.id]    || 0,
      totalCollected: collectedMap[d.id] || 0,
      outstanding:    (billedMap[d.id] || 0) - (collectedMap[d.id] || 0),
    })).sort((a, b) => b.outstanding - a.outstanding)

    setLedger(ledgerData)
    setLoading(false)
  }

  async function fetchRecentPayments() {
    const { data } = await supabase
      .from('distributor_payments')
      .select('id, entry_date, amount, payment_mode, notes, reference_no, distributor_id, entered_at')
      .order('entry_date', { ascending: false })
      .order('entered_at', { ascending: false })
      .limit(30)
    setRecentPayments(data || [])
  }

  function handleDistSelect(distId) {
    setSelectedDist(distId)
    const d = ledger.find(l => l.id === distId)
    if (d && d.outstanding > 0) setAmount(d.outstanding.toFixed(2))
    else setAmount('')
  }

  async function handleSave() {
    if (!selectedDist)                          { toast.error('Select a distributor'); return }
    if (!amount || parseFloat(amount) <= 0)     { toast.error('Enter valid amount');   return }

    const dist = ledger.find(l => l.id === selectedDist)
    if (dist && parseFloat(amount) > dist.outstanding + 0.01) {
      const ok = confirm(`Amount ₹${amount} is more than outstanding ₹${dist.outstanding.toFixed(2)}. Proceed as advance?`)
      if (!ok) return
    }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('distributor_payments').insert({
      distributor_id: selectedDist,
      entry_date:     date,
      amount:         parseFloat(amount),
      payment_mode:   mode,
      notes:          notes || null,
      reference_no:   reference || null,
      entered_by:     user?.id,
      entered_at:     new Date().toISOString(),
    })

    if (error) {
      toast.error('Failed: ' + error.message)
    } else {
      const distName = dist?.name || 'Distributor'
      toast.success(`₹${parseFloat(amount).toLocaleString('en-IN')} collected from ${distName}`)
      // Auto-send receipt after saving
      sendReceiptAfterSave({ dist, amount: parseFloat(amount), date, mode, reference, notes })
      setAmount(''); setNotes(''); setReference(''); setMode('cash'); setSelectedDist('')
      fetchLedger(); fetchRecentPayments()
    }
    setSaving(false)
  }

  // Called automatically after a successful save — opens a toast with PDF+WA options
  async function sendReceiptAfterSave({ dist, amount, date: d, mode: m, reference: r, notes: n }) {
    try {
      const receiptDate = new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      const doc = await generatePaymentReceiptPDF({
        receiptNo:   generateInvoiceNo('MF-PR'),
        date:        receiptDate,
        distributor: dist,
        amount,
        paymentMode: m,
        referenceNo: r || null,
        notes:       n || null,
      })
      openPDFAndShareWhatsApp(doc, dist?.phone, 'Payment Receipt')
      toast.success('Receipt PDF opened! WhatsApp opening shortly…')
    } catch (err) {
      // Non-fatal — payment is already saved
      console.error('Receipt PDF failed:', err)
    }
  }

  // Manual re-send from history row
  async function sendReceiptPDF(payment) {
    const dist = distributors.find(d => d.id === payment.distributor_id)
    try {
      const doc = await generatePaymentReceiptPDF({
        receiptNo:   generateInvoiceNo('MF-PR'),
        date:        new Date(payment.entry_date).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'long', year: 'numeric'
        }),
        distributor: dist || { name: '—' },
        amount:      parseFloat(payment.amount),
        paymentMode: payment.payment_mode,
        referenceNo: payment.reference_no,
        notes:       payment.notes,
      })
      openPDFAndShareWhatsApp(doc, dist?.phone, 'Payment Receipt')
      toast.success('PDF opened! WhatsApp opening shortly…')
    } catch (err) {
      toast.error('Failed: ' + err.message)
    }
  }

  function sendWhatsAppMessage(payment) {
    const dist = distributors.find(d => d.id === payment.distributor_id)
    if (!dist?.phone) { toast.error('No phone number for this distributor'); return }
    const msg = encodeURIComponent(
      `Dear ${dist.name},\n\nWe have received your payment of ₹${parseFloat(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })} on ${new Date(payment.entry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} via ${payment.payment_mode?.toUpperCase()}${payment.reference_no ? ` (Ref: ${payment.reference_no})` : ''}.\n\nThank you for your payment!\n— MilkyFeast 🙏`
    )
    const num = dist.phone.replace(/\D/g, '')
    window.open(`https://wa.me/${num.startsWith('91') ? num : '91' + num}?text=${msg}`, '_blank')
  }

  async function deletePayment(id) {
    if (!confirm('Delete this payment record?')) return
    const { error } = await supabase.from('distributor_payments').delete().eq('id', id)
    if (error) toast.error('Failed')
    else { toast.success('Deleted'); fetchLedger(); fetchRecentPayments() }
  }

  const selectedDistData = ledger.find(l => l.id === selectedDist)
  const totalOutstanding = ledger.reduce((s, l) => s + l.outstanding, 0)
  const totalBilled      = ledger.reduce((s, l) => s + l.totalBilled, 0)
  const totalCollected   = ledger.reduce((s, l) => s + l.totalCollected, 0)

  const fmt = n => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Payment Collection</div>
          <div className="page-subtitle">Record cash received from distributors against outstanding bills</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* History shortcut */}
          <Link href="/dashboard/sales/payments/history" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
            <History size={14} /> Payment History
          </Link>
          <div style={{ position: 'relative' }}>
            <Calendar size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
            <input type="date" className="input" style={{ paddingLeft: 36, width: 180 }}
              value={date} onChange={e => setDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]} />
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div className="pc-summary">
        {[
          { label: 'Total Billed',      val: fmt(totalBilled),     color: 'var(--blue)'  },
          { label: 'Cash Collected',    val: fmt(totalCollected),  color: 'var(--green)' },
          { label: 'Still Outstanding', val: fmt(totalOutstanding),color: totalOutstanding > 0 ? 'var(--red)' : 'var(--green)' },
          { label: 'Collection Rate',   val: totalBilled > 0 ? `${((totalCollected / totalBilled) * 100).toFixed(1)}%` : '0%', color: 'var(--text)' },
        ].map(s => (
          <div key={s.label} className="pc-sum-item">
            <span className="pc-sum-label">{s.label}</span>
            <span className="pc-sum-val" style={{ color: s.color }}>{s.val}</span>
          </div>
        ))}
      </div>

      <div className="pc-layout">
        {/* Left: payment entry form */}
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-section-hdr">
              <IndianRupee size={15} color="var(--green)" />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>Record Payment Received</span>
            </div>

            <div className="form-group">
              <label className="label">Distributor *</label>
              <select className="input" value={selectedDist} onChange={e => handleDistSelect(e.target.value)}>
                <option value="">— Select distributor —</option>
                {ledger.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}{d.outstanding > 0 ? ` — Outstanding: ₹${d.outstanding.toLocaleString('en-IN')}` : ' — Clear'}
                  </option>
                ))}
              </select>
            </div>

            {selectedDistData && (
              <div className="dist-balance-info">
                <div className="dbi-row">
                  <span className="text-muted">Total Billed</span>
                  <span style={{ fontWeight: 600 }}>{fmt(selectedDistData.totalBilled)}</span>
                </div>
                <div className="dbi-row">
                  <span className="text-muted">Already Collected</span>
                  <span style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt(selectedDistData.totalCollected)}</span>
                </div>
                <div className="dbi-row dbi-total">
                  <span style={{ fontWeight: 700 }}>Outstanding Balance</span>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18,
                    color: selectedDistData.outstanding > 0 ? 'var(--red)' : 'var(--green)'
                  }}>
                    {fmt(selectedDistData.outstanding)}
                  </span>
                </div>
              </div>
            )}

            <div className="grid-2">
              <div className="form-group">
                <label className="label">Amount Received (₹) *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', fontSize: 14 }}>₹</span>
                  <input className="input" type="number" style={{ paddingLeft: 26 }}
                    placeholder="0.00" min="1" step="0.01"
                    value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
                {selectedDistData && selectedDistData.outstanding > 0 && (
                  <button style={{ marginTop: 5, fontSize: 11, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    onClick={() => setAmount(selectedDistData.outstanding.toFixed(2))}>
                    Pay full outstanding: {fmt(selectedDistData.outstanding)}
                  </button>
                )}
              </div>
              <div className="form-group">
                <label className="label">Payment Mode *</label>
                <select className="input" value={mode} onChange={e => setMode(e.target.value)}>
                  {PAYMENT_MODES.map(m => (
                    <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="label">Reference No. (UPI/Cheque)</label>
                <input className="input" placeholder="UTR / Cheque no. / Transaction ID"
                  value={reference} onChange={e => setReference(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Notes</label>
                <input className="input" placeholder="Optional note…"
                  value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                Receipt PDF + WhatsApp will open automatically after save
              </span>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving
                  ? <><Loader2 size={14} className="spin" /> Saving…</>
                  : <><CheckCircle2 size={14} /> Save & Send Receipt</>
                }
              </button>
            </div>
          </div>
        </div>

        {/* Right: distributor ledger */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>Distributor Ledger</div>
            <span className="badge badge-red">{ledger.filter(l => l.outstanding > 0.01).length} outstanding</span>
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: 'var(--text-3)', gap: 10 }}>
              <Loader2 size={18} className="spin" /> Loading…
            </div>
          ) : (
            <div className="ledger-list">
              {ledger.map(d => (
                <div key={d.id} className="ledger-row">
                  <div className="ledger-row-main" onClick={() => setExpandedDist(expandedDist === d.id ? null : d.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {expandedDist === d.id ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{d.name}</div>
                        {d.route && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{d.route}</div>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
                        color: d.outstanding > 0.01 ? 'var(--red)' : 'var(--green)'
                      }}>
                        {fmt(d.outstanding)}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-3)' }}>outstanding</div>
                    </div>
                  </div>

                  {expandedDist === d.id && (
                    <div className="ledger-detail">
                      <div className="ledger-detail-row">
                        <span>Total Billed</span>
                        <span style={{ color: 'var(--blue)', fontWeight: 600 }}>{fmt(d.totalBilled)}</span>
                      </div>
                      <div className="ledger-detail-row">
                        <span>Collected</span>
                        <span style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt(d.totalCollected)}</span>
                      </div>
                      <div className="ledger-detail-row" style={{ borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 4 }}>
                        <span style={{ fontWeight: 600 }}>Outstanding</span>
                        <span style={{ color: d.outstanding > 0.01 ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>{fmt(d.outstanding)}</span>
                      </div>
                      {d.outstanding > 0.01 && (
                        <button className="btn btn-primary btn-sm" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}
                          onClick={() => { handleDistSelect(d.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                          <IndianRupee size={12} /> Collect Payment
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent payments table */}
      {recentPayments.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>
              Recent Payment Collections
            </div>
            <Link href="/dashboard/sales/payments/history" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none', fontSize: 12 }}>
              <History size={13} /> Full History
            </Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Distributor</th>
                  <th>Amount</th>
                  <th>Mode</th>
                  <th>Reference</th>
                  <th>Notes</th>
                  <th style={{ width: 200 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map(p => {
                  const dist = distributors.find(d => d.id === p.distributor_id)
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 500 }}>
                        {new Date(p.entry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ fontWeight: 500 }}>{dist?.name || '—'}</td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--green)' }}>
                          {fmt(p.amount)}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-blue">{p.payment_mode}</span>
                      </td>
                      <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{p.reference_no || <span className="text-faint">—</span>}</td>
                      <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{p.notes || <span className="text-faint">—</span>}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {/* WA text message */}
                          <button
                            title="Send WhatsApp message"
                            onClick={() => sendWhatsAppMessage(p)}
                            className="action-btn wa-action-btn"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="#25d366">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            WA Msg
                          </button>

                          {/* PDF receipt + WA */}
                          <button
                            title="Share PDF Receipt"
                            onClick={() => sendReceiptPDF(p)}
                            className="action-btn pdf-action-btn"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                              <polyline points="14 2 14 8 20 8"/>
                            </svg>
                            PDF
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => deletePayment(p.id)}
                            className="del-icon-btn"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        .pc-summary {
          display: flex; background: var(--surface);
          border: 1px solid var(--border); border-radius: var(--r-lg);
          overflow: hidden; margin-bottom: 24px;
        }
        .pc-sum-item { flex: 1; padding: 18px 20px; text-align: center; border-right: 1px solid var(--border); }
        .pc-sum-item:last-child { border-right: none; }
        .pc-sum-label { display: block; font-size: 10px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
        .pc-sum-val { font-family: var(--font-display); font-size: 20px; font-weight: 700; }

        .pc-layout { display: grid; grid-template-columns: 1fr 320px; gap: 20px; align-items: start; }

        .card-section-hdr { display: flex; align-items: center; gap: 10px; padding-bottom: 16px; margin-bottom: 16px; border-bottom: 1px solid var(--border); }

        .dist-balance-info { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r-md); padding: 14px 16px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 8px; }
        .dbi-row { display: flex; align-items: center; justify-content: space-between; font-size: 13px; }
        .dbi-total { padding-top: 8px; border-top: 1px solid var(--border); }

        .ledger-list { max-height: 520px; overflow-y: auto; }
        .ledger-row { border-bottom: 1px solid var(--border); }
        .ledger-row:last-child { border-bottom: none; }
        .ledger-row-main { display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; cursor: pointer; transition: background 0.12s; }
        .ledger-row-main:hover { background: var(--surface-2); }
        .ledger-detail { padding: 10px 18px 14px 38px; background: var(--surface-2); border-top: 1px solid var(--border); }
        .ledger-detail-row { display: flex; justify-content: space-between; font-size: 12.5px; color: var(--text-2); padding: 3px 0; }

        /* Action buttons in recent payments table */
        .action-btn {
          display: flex; align-items: center; gap: 4px;
          padding: 5px 8px; border-radius: var(--r-sm);
          border: 1px solid; font-size: 11px; cursor: pointer;
          font-family: var(--font-body); transition: all 0.12s;
        }
        .wa-action-btn {
          background: rgba(37,211,102,0.08);
          border-color: rgba(37,211,102,0.3);
          color: #128c7e;
        }
        .wa-action-btn:hover { background: rgba(37,211,102,0.16); }
        .pdf-action-btn {
          background: var(--blue-dim);
          border-color: rgba(37,99,235,0.3);
          color: var(--blue);
        }
        .pdf-action-btn:hover { background: rgba(96,165,250,0.15); }
        .del-icon-btn {
          width: 28px; height: 28px; border-radius: var(--r-sm);
          background: none; border: 1px solid transparent;
          color: var(--text-3); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.12s;
        }
        .del-icon-btn:hover { background: var(--red-dim); color: var(--red); border-color: rgba(239,68,68,0.3); }

        :global(.spin) { animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {

  /* Header */
  .page-header {
    flex-direction: column;
    align-items: stretch !important;
    gap: 12px;
  }

  .page-header > div:last-child {
    width: 100%;
    flex-direction: column;
    align-items: stretch !important;
    gap: 10px !important;
  }

  .page-header .btn {
    width: 100%;
    justify-content: center;
  }

  .page-header .input {
    width: 100% !important;
  }

  /* Summary cards */
  .pc-summary {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .pc-sum-item {
    padding: 14px;
    min-width: unset;
  }

  .pc-sum-val {
    font-size: 16px;
  }

  /* Main layout */
  .pc-layout {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  /* Form grids */
  .grid-2 {
    grid-template-columns: 1fr !important;
  }

  /* Cards */
  .card {
    padding: 14px;
  }

  /* Ledger */
  .ledger-list {
    max-height: none;
  }

  .ledger-row-main {
    padding: 12px;
  }

  /* Buttons */
  .btn {
    min-height: 44px;
  }

  .action-btn {
    min-height: 40px;
    padding: 8px 10px;
    font-size: 11px;
  }

  .del-icon-btn {
    width: 40px;
    height: 40px;
  }

  /* Table scrolling */
  .table-wrap {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  table {
    min-width: 900px;
  }

  /* Titles */
  .page-title {
    font-size: 24px;
  }

  .page-subtitle {
    font-size: 13px;
  }

  /* Inputs */
  .input {
    min-height: 44px;
  }
}
      `}</style>
    </div>
  )
}
