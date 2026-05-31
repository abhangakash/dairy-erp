'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  IndianRupee, Save, Loader2, Calendar,
  Search, X, TrendingDown, CheckCircle2,
  ChevronDown, ChevronRight, Phone, CreditCard
} from 'lucide-react'

const PAYMENT_MODES = ['cash', 'upi', 'bank', 'cheque', 'other']

export default function PaymentCollectionPage() {
  const [distributors, setDistributors] = useState([])
  const [ledger, setLedger]             = useState([]) // balances per distributor
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [date, setDate]                 = useState(new Date().toISOString().split('T')[0])

  // Payment form
  const [selectedDist, setSelectedDist] = useState('')
  const [amount, setAmount]             = useState('')
  const [mode, setMode]                 = useState('cash')
  const [notes, setNotes]               = useState('')
  const [reference, setReference]       = useState('')

  // Recent payments
  const [recentPayments, setRecentPayments] = useState([])
  const [expandedDist, setExpandedDist]     = useState(null)

  useEffect(() => {
    fetchLedger()
    fetchRecentPayments()
  }, [])

  // ── Fetch distributor balances ────────────────────────
  async function fetchLedger() {
    setLoading(true)

    // Get all distributors
    const { data: dists } = await supabase
      .from('distributors')
      .select('id, name, phone, route')
      .eq('is_active', true)
      .order('name')

    if (!dists || dists.length === 0) { setDistributors([]); setLedger([]); setLoading(false); return }
    setDistributors(dists)

    // Total billed per distributor
    const { data: billed } = await supabase
      .from('daily_sales')
      .select('distributor_id, daily_sale_items(total_amount)')

    const billedMap = {}
    ;(billed || []).forEach(sale => {
      const total = (sale.daily_sale_items || []).reduce((s, i) => s + parseFloat(i.total_amount || 0), 0)
      billedMap[sale.distributor_id] = (billedMap[sale.distributor_id] || 0) + total
    })

    // Total collected per distributor
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
      .select('id, entry_date, amount, payment_mode, notes, reference_no, distributor_id')
      .order('entry_date', { ascending: false })
      .order('entered_at', { ascending: false })
      .limit(30)
    setRecentPayments(data || [])
  }

  // ── When distributor selected → auto fill amount ──────
  function handleDistSelect(distId) {
    setSelectedDist(distId)
    const d = ledger.find(l => l.id === distId)
    if (d && d.outstanding > 0) {
      setAmount(d.outstanding.toFixed(2))
    } else {
      setAmount('')
    }
  }

  // ── Save payment ──────────────────────────────────────
  async function handleSave() {
    if (!selectedDist)          { toast.error('Select a distributor'); return }
    if (!amount || parseFloat(amount) <= 0) { toast.error('Enter valid amount'); return }

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
      setAmount('')
      setNotes('')
      setReference('')
      setMode('cash')
      setSelectedDist('')
      fetchLedger()
      fetchRecentPayments()
    }
    setSaving(false)
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
        <div style={{ position: 'relative' }}>
          <Calendar size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
          <input type="date" className="input" style={{ paddingLeft: 36, width: 180 }}
            value={date} onChange={e => setDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]} />
        </div>
      </div>

      {/* Summary strip */}
      <div className="pc-summary">
        {[
          { label: 'Total Billed',     val: fmt(totalBilled),     color: 'var(--blue)'   },
          { label: 'Cash Collected',   val: fmt(totalCollected),  color: 'var(--green)'  },
          { label: 'Still Outstanding',val: fmt(totalOutstanding),color: totalOutstanding > 0 ? 'var(--red)' : 'var(--green)' },
          { label: 'Collection Rate',  val: totalBilled > 0 ? `${((totalCollected/totalBilled)*100).toFixed(1)}%` : '0%', color: 'var(--text)' },
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

            {/* Distributor */}
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

            {/* Outstanding info */}
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
              {/* Amount */}
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

              {/* Payment mode */}
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
              {/* Reference */}
              <div className="form-group">
                <label className="label">Reference No. (UPI/Cheque)</label>
                <input className="input" placeholder="UTR / Cheque no. / Transaction ID"
                  value={reference} onChange={e => setReference(e.target.value)} />
              </div>

              {/* Notes */}
              <div className="form-group">
                <label className="label">Notes</label>
                <input className="input" placeholder="Optional note…"
                  value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Saved with user ID · timestamp · IP</span>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving
                  ? <><Loader2 size={14} className="spin" /> Saving…</>
                  : <><CheckCircle2 size={14} /> Save Payment</>
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
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, marginBottom: 14 }}>
            Recent Payment Collections
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
                  <th></th>
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
                        <button
                          onClick={() => deletePayment(p.id)}
                          style={{ width: 28, height: 28, borderRadius: 'var(--r-sm)', background: 'none', border: '1px solid transparent', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s' }}
                          onMouseOver={e => { e.currentTarget.style.background = 'var(--red-dim)'; e.currentTarget.style.color = 'var(--red)' }}
                          onMouseOut={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-3)' }}>
                          <X size={13} />
                        </button>
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

        :global(.spin) { animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 860px) {
          .pc-layout { grid-template-columns: 1fr; }
          .pc-summary { flex-wrap: wrap; }
          .pc-sum-item { min-width: 50%; }
        }
      `}</style>
    </div>
  )
}
