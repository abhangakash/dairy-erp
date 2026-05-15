'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  IndianRupee, Calendar, Loader2, Send,
  CheckCircle2, Clock, X, Save, Users, ChevronDown
} from 'lucide-react'
import { calculateGrossSalary, countPresentDays } from '@/lib/utils/salary'
import { getWhatsAppLink, formatSalaryReceipt } from '@/lib/utils/whatsapp'

function getMonthOptions() {
  const months = []
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const val   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    months.push({ val, label })
  }
  return months
}

export default function SalaryPage() {
  const MONTHS = getMonthOptions()

  const [workers, setWorkers]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [month, setMonth]         = useState(MONTHS[0].val)
  const [salaryData, setSalaryData] = useState([]) // computed per worker
  const [payModal, setPayModal]   = useState(null) // worker salary object
  const [payAmount, setPayAmount] = useState('')
  const [saving, setSaving]       = useState(false)

  useEffect(() => { fetchWorkers() }, [])
  useEffect(() => { if (workers.length > 0) computeSalaries(month) }, [month, workers])

  async function fetchWorkers() {
    setLoading(true)
    const { data } = await supabase
      .from('workers')
      .select('id, name, phone, role, salary_type, salary_amount')
      .eq('is_active', true)
      .order('name')
    setWorkers(data || [])
    setLoading(false)
  }

  async function computeSalaries(forMonth) {
    setLoading(true)

    // Date range for month
    const [year, mon] = forMonth.split('-').map(Number)
    const firstDay = `${forMonth}-01`
    const lastDay  = new Date(year, mon, 0).toISOString().split('T')[0]

    // Fetch attendance for all workers for this month
    const { data: attData } = await supabase
      .from('worker_attendance')
      .select('worker_id, status')
      .gte('entry_date', firstDay)
      .lte('entry_date', lastDay)

    // Fetch existing salary payments for this month
    const { data: payData } = await supabase
      .from('salary_payments')
      .select('*')
      .eq('month', forMonth)

    const result = workers.map(w => {
      const workerAtt  = (attData || []).filter(a => a.worker_id === w.id)
      const presentDays = countPresentDays(workerAtt)
      const gross      = calculateGrossSalary(w, presentDays)
      const existing   = (payData || []).find(p => p.worker_id === w.id)

      return {
        worker:       w,
        presentDays,
        gross,
        paid:         existing ? parseFloat(existing.paid_amount) : 0,
        remaining:    existing ? parseFloat(existing.remaining)   : gross,
        status:       existing ? existing.payment_status          : 'pending',
        paymentId:    existing?.id || null,
        receiptSent:  existing?.receipt_sent || false,
      }
    })

    setSalaryData(result)
    setLoading(false)
  }

  function openPayModal(workerSalary) {
    setPayModal(workerSalary)
    setPayAmount(workerSalary.remaining > 0 ? workerSalary.remaining.toFixed(2) : '')
  }

  function closePayModal() {
    setPayModal(null)
    setPayAmount('')
  }

  async function handlePay() {
    if (!payAmount || isNaN(payAmount) || parseFloat(payAmount) <= 0) {
      toast.error('Enter valid amount'); return
    }
    const amount = parseFloat(payAmount)
    if (amount > payModal.remaining + 0.01) {
      toast.error(`Cannot pay more than remaining (₹${payModal.remaining.toFixed(2)})`); return
    }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    const newPaid      = payModal.paid + amount
    const newRemaining = payModal.gross - newPaid
    const newStatus    = newRemaining <= 0.01 ? 'paid' : newPaid > 0 ? 'partial' : 'pending'

    if (payModal.paymentId) {
      // Update existing record
      const { error } = await supabase
        .from('salary_payments')
        .update({
          paid_amount:    newPaid,
          payment_status: newStatus,
          paid_date:      newStatus === 'paid' ? new Date().toISOString().split('T')[0] : null,
          entered_by:     user?.id,
        })
        .eq('id', payModal.paymentId)
      if (error) { toast.error('Failed to update'); setSaving(false); return }
    } else {
      // Create new record
      const { error } = await supabase
        .from('salary_payments')
        .insert({
          worker_id:      payModal.worker.id,
          month:          month,
          working_days:   payModal.worker.salary_type === 'daily_wage' ? payModal.presentDays : null,
          gross_amount:   payModal.gross,
          paid_amount:    newPaid,
          payment_status: newStatus,
          paid_date:      newStatus === 'paid' ? new Date().toISOString().split('T')[0] : null,
          entered_by:     user?.id,
          entered_at:     new Date().toISOString(),
        })
      if (error) { toast.error('Failed to save'); setSaving(false); return }
    }

    toast.success(`₹${amount.toLocaleString('en-IN')} paid to ${payModal.worker.name}`)
    computeSalaries(month)

    // Auto-open WhatsApp receipt if phone exists
    const updatedWorkerSalary = {
      ...payModal,
      paid:      newPaid,
      remaining: newRemaining,
      status:    newStatus,
    }
    closePayModal()

    if (payModal.worker.phone) {
      sendReceipt(updatedWorkerSalary, amount)
    }

    setSaving(false)
  }

  function sendReceipt(ws, justPaid) {
    if (!ws.worker.phone) { toast.error('No phone number for this worker'); return }
    const message = formatSalaryReceipt({
      worker:      ws.worker,
      month:       MONTHS.find(m => m.val === month)?.label || month,
      workingDays: ws.worker.salary_type === 'daily_wage' ? ws.presentDays : null,
      gross:       ws.gross,
      paid:        ws.paid,
      remaining:   ws.remaining,
    })
    const link = getWhatsAppLink(ws.worker.phone, message)
    window.open(link, '_blank')
    toast.success('Receipt opened in WhatsApp')
  }

  // Stats
  const totalGross     = salaryData.reduce((s, d) => s + d.gross, 0)
  const totalPaid      = salaryData.reduce((s, d) => s + d.paid, 0)
  const totalRemaining = salaryData.reduce((s, d) => s + d.remaining, 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Salary Payments</div>
          <div className="page-subtitle">
            {MONTHS.find(m => m.val === month)?.label} — salary management
          </div>
        </div>
        <div className="month-select-wrap">
          <Calendar size={14} className="cal-icon" />
          <select className="input month-select" value={month}
            onChange={e => setMonth(e.target.value)}>
            {MONTHS.map(m => (
              <option key={m.val} value={m.val}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="salary-summary">
        <div className="sal-sum-item">
          <span className="sal-sum-label">Total Gross</span>
          <span className="sal-sum-val">₹{totalGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="sal-sum-divider" />
        <div className="sal-sum-item">
          <span className="sal-sum-label">Total Paid</span>
          <span className="sal-sum-val text-green">₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="sal-sum-divider" />
        <div className="sal-sum-item">
          <span className="sal-sum-label">Remaining</span>
          <span className="sal-sum-val text-yellow">₹{totalRemaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="sal-sum-divider" />
        <div className="sal-sum-item">
          <span className="sal-sum-label">Fully Paid</span>
          <span className="sal-sum-val text-green">
            {salaryData.filter(d => d.status === 'paid').length}/{salaryData.length}
          </span>
        </div>
      </div>

      {/* Worker salary cards */}
      {loading ? (
        <div className="loading-state"><Loader2 size={22} className="spin" /> Computing salaries…</div>
      ) : salaryData.length === 0 ? (
        <div className="empty-state card">
          <Users size={32} /><p>No active workers found</p>
        </div>
      ) : (
        <div className="salary-list">
          {salaryData.map(d => (
            <div key={d.worker.id} className={`salary-card status-${d.status}`}>
              <div className="salary-card-left">
                <div className="worker-avatar">
                  {d.worker.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="worker-name">{d.worker.name}</div>
                  <div className="worker-meta">
                    {d.worker.role && <span className="badge badge-blue" style={{ fontSize: 10 }}>{d.worker.role}</span>}
                    <span className="text-faint" style={{ fontSize: 11 }}>
                      {d.worker.salary_type === 'daily_wage'
                        ? `Daily ₹${d.worker.salary_amount} × ${d.presentDays} days`
                        : `Fixed ₹${parseFloat(d.worker.salary_amount).toLocaleString('en-IN')}/mo`
                      }
                    </span>
                  </div>
                </div>
              </div>

              <div className="salary-amounts">
                <div className="sal-amt-item">
                  <span className="sal-amt-label">Gross</span>
                  <span className="sal-amt-val">₹{d.gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="sal-amt-item">
                  <span className="sal-amt-label">Paid</span>
                  <span className="sal-amt-val text-green">₹{d.paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="sal-amt-item">
                  <span className="sal-amt-label">Remaining</span>
                  <span className={`sal-amt-val ${d.remaining > 0 ? 'text-yellow' : 'text-green'}`}>
                    ₹{d.remaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="salary-progress-wrap">
                <div className="salary-progress-bar">
                  <div
                    className="salary-progress-fill"
                    style={{ width: `${d.gross > 0 ? (d.paid / d.gross) * 100 : 0}%` }}
                  />
                </div>
                <span className="salary-pct">
                  {d.gross > 0 ? Math.round((d.paid / d.gross) * 100) : 0}%
                </span>
              </div>

              <div className="salary-card-actions">
                <span className={`badge ${
                  d.status === 'paid'    ? 'badge-green'  :
                  d.status === 'partial' ? 'badge-yellow' :
                  'badge-red'
                }`}>
                  {d.status === 'paid' ? '✓ Paid' : d.status === 'partial' ? 'Partial' : 'Pending'}
                </span>

                {d.remaining > 0.01 && (
                  <button className="btn btn-primary btn-sm" onClick={() => openPayModal(d)}>
                    <IndianRupee size={12} /> Pay
                  </button>
                )}

                {d.paid > 0 && d.worker.phone && (
                  <button className="btn btn-ghost btn-sm whatsapp-btn" onClick={() => sendReceipt(d)}>
                    <Send size={12} /> Receipt
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pay Modal */}
      {payModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && closePayModal()}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>
                  Pay Salary
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                  {payModal.worker.name} · {MONTHS.find(m => m.val === month)?.label}
                </div>
              </div>
              <button className="modal-close" onClick={closePayModal}><X size={16} /></button>
            </div>

            <div className="modal-body">
              {/* Summary */}
              <div className="pay-summary">
                <div className="pay-sum-row">
                  <span>Gross Salary</span>
                  <span>₹{payModal.gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {payModal.worker.salary_type === 'daily_wage' && (
                  <div className="pay-sum-row">
                    <span>Working Days</span>
                    <span>{payModal.presentDays} days × ₹{payModal.worker.salary_amount}</span>
                  </div>
                )}
                <div className="pay-sum-row">
                  <span>Already Paid</span>
                  <span className="text-green">₹{payModal.paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="pay-sum-row pay-sum-total">
                  <span>Remaining</span>
                  <span className="text-yellow">₹{payModal.remaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 18 }}>
                <label className="label">Amount to Pay Now (₹) *</label>
                <div className="pay-input-wrap">
                  <span className="pay-rupee">₹</span>
                  <input
                    className="input"
                    type="number"
                    style={{ paddingLeft: 28 }}
                    placeholder="0.00"
                    min="1"
                    max={payModal.remaining}
                    step="1"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    autoFocus
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}
                    onClick={() => setPayAmount(payModal.remaining.toFixed(2))}>
                    Pay full (₹{payModal.remaining.toFixed(2)})
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}
                    onClick={() => setPayAmount((payModal.remaining / 2).toFixed(2))}>
                    Pay half
                  </button>
                </div>
              </div>

              {payModal.worker.phone ? (
                <div className="phone-notice">
                  <Send size={12} />
                  WhatsApp receipt will open automatically for {payModal.worker.phone}
                </div>
              ) : (
                <div className="no-phone-warn">
                  No phone number saved. Add phone in Worker Master to send WhatsApp receipt.
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closePayModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handlePay} disabled={saving}>
                {saving
                  ? <><Loader2 size={14} className="spin" /> Saving…</>
                  : <><CheckCircle2 size={14} /> Confirm Payment</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .month-select-wrap { position: relative; }
        .cal-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-3); pointer-events: none; }
        .month-select { padding-left: 36px; min-width: 200px; }

        .salary-summary {
          display: flex; align-items: stretch;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); overflow: hidden; margin-bottom: 24px;
        }
        .sal-sum-item { flex: 1; padding: 18px 20px; text-align: center; }
        .sal-sum-label { display: block; font-size: 11px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 8px; }
        .sal-sum-val { font-family: var(--font-display); font-size: 18px; font-weight: 700; color: var(--text); }
        .sal-sum-divider { width: 1px; background: var(--border); }

        .loading-state { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 60px; color: var(--text-3); }

        .salary-list { display: flex; flex-direction: column; gap: 10px; }
        .salary-card {
          display: grid;
          grid-template-columns: 1fr auto auto auto;
          gap: 20px; align-items: center;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-md); padding: 16px 20px;
          transition: border-color 0.14s;
        }
        .status-paid    { border-left: 3px solid var(--green); }
        .status-partial { border-left: 3px solid var(--yellow); }
        .status-pending { border-left: 3px solid var(--red); }

        .salary-card-left { display: flex; align-items: center; gap: 12px; }
        .worker-avatar {
          width: 38px; height: 38px; border-radius: var(--r-sm);
          background: var(--brand-glow); border: 1px solid rgba(249,115,22,0.2);
          color: var(--brand); font-family: var(--font-display);
          font-size: 16px; font-weight: 700;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .worker-name { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
        .worker-meta { display: flex; align-items: center; gap: 6px; }

        .salary-amounts { display: flex; gap: 20px; }
        .sal-amt-item { text-align: center; }
        .sal-amt-label { display: block; font-size: 10px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
        .sal-amt-val { font-family: var(--font-display); font-size: 15px; font-weight: 700; }

        .salary-progress-wrap { display: flex; align-items: center; gap: 10px; min-width: 100px; }
        .salary-progress-bar { flex: 1; height: 6px; background: var(--surface-2); border-radius: 99px; overflow: hidden; }
        .salary-progress-fill { height: 100%; background: var(--green); border-radius: 99px; transition: width 0.4s ease; }
        .salary-pct { font-size: 11px; color: var(--text-3); white-space: nowrap; }

        .salary-card-actions { display: flex; align-items: center; gap: 8px; }
        .whatsapp-btn { color: #25d366 !important; }

        /* Pay modal */
        .pay-summary {
          background: var(--surface-2); border: 1px solid var(--border);
          border-radius: var(--r-md); padding: 14px 16px;
          display: flex; flex-direction: column; gap: 8px;
        }
        .pay-sum-row { display: flex; justify-content: space-between; font-size: 13px; color: var(--text-2); }
        .pay-sum-total { font-weight: 600; color: var(--text); padding-top: 8px; border-top: 1px solid var(--border); }
        .pay-input-wrap { position: relative; }
        .pay-rupee { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); font-size: 14px; color: var(--text-3); }
        .phone-notice { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 12px; color: var(--green); background: var(--green-dim); border-radius: var(--r-sm); padding: 10px 14px; }
        .no-phone-warn { margin-top: 12px; font-size: 12px; color: var(--yellow); background: var(--yellow-dim); border-radius: var(--r-sm); padding: 10px 14px; }

        .modal-close { width: 32px; height: 32px; border-radius: var(--r-sm); background: var(--surface-2); border: 1px solid var(--border); color: var(--text-2); cursor: pointer; display: flex; align-items: center; justify-content: center; }

        :global(.spin) { animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 1100px) {

  .salary-card {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .salary-amounts {
    justify-content: space-between;
    width: 100%;
  }

  .salary-progress-wrap {
    width: 100%;
  }

  .salary-card-actions {
    width: 100%;
    flex-wrap: wrap;
  }
}

@media (max-width: 768px) {

  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
  }

  .month-select-wrap {
    width: 100%;
  }

  .month-select {
    width: 100%;
    min-width: 0;
  }

  .salary-summary {
    flex-direction: column;
  }

  .sal-sum-divider {
    width: 100%;
    height: 1px;
  }

  .sal-sum-item {
    width: 100%;
  }

  .salary-card {
    padding: 14px;
  }

  .salary-card-left {
    align-items: flex-start;
  }

  .salary-amounts {
    flex-wrap: wrap;
    gap: 14px;
  }

  .sal-amt-item {
    flex: 1 1 40%;
    text-align: left;
  }

  .salary-card-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .salary-card-actions .btn {
    width: 100%;
    justify-content: center;
  }

  .bottom-save {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .bottom-save .btn {
    width: 100%;
    justify-content: center;
  }

  .modal {
    width: calc(100vw - 20px) !important;
    margin: 10px;
    max-width: unset !important;
  }

  .modal-footer {
    flex-direction: column;
    gap: 10px;
  }

  .modal-footer .btn {
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 520px) {

  .page-title {
    font-size: 20px;
  }

  .page-subtitle {
    font-size: 13px;
  }

  .sal-sum-val {
    font-size: 16px;
  }

  .worker-meta {
    flex-wrap: wrap;
  }

  .salary-amounts {
    flex-direction: column;
    gap: 10px;
  }

  .sal-amt-item {
    width: 100%;
  }

  .salary-progress-wrap {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }

  .pay-summary {
    padding: 12px;
  }

  .pay-sum-row {
    font-size: 12px;
    gap: 8px;
  }

  .phone-notice,
  .no-phone-warn {
    font-size: 11px;
    line-height: 1.5;
  }
}
      `}</style>
    </div>
  )
}