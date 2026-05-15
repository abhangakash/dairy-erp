'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  HandCoins, Plus, X, Loader2, Save,
  ArrowUpRight, ArrowDownLeft, TrendingUp,
  TrendingDown, RefreshCw, Calendar, Search
} from 'lucide-react'

const TX_TYPES = [
  { value: 'given',       label: 'Given to Partner',   color: 'var(--red)',    icon: ArrowUpRight,   dir: 'out' },
  { value: 'taken',       label: 'Taken from Partner', color: 'var(--green)',  icon: ArrowDownLeft,  dir: 'in'  },
  { value: 'loan_given',  label: 'Loan Given',         color: 'var(--yellow)', icon: TrendingUp,     dir: 'out' },
  { value: 'loan_taken',  label: 'Loan Taken',         color: 'var(--blue)',   icon: TrendingDown,   dir: 'in'  },
  { value: 'loan_repaid', label: 'Loan Repaid',        color: 'var(--green)',  icon: RefreshCw,      dir: 'in'  },
]

const EMPTY_FORM = {
  partner_id: '', transaction_type: 'given',
  amount: '', purpose: '', notes: '', entry_date: new Date().toISOString().split('T')[0]
}

export default function PartnersPage() {
  const [partners, setPartners]         = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading]           = useState(true)
  const [modalOpen, setModalOpen]       = useState(false)
  const [saving, setSaving]             = useState(false)
  const [form, setForm]                 = useState(EMPTY_FORM)
  const [filterPartner, setFilterPartner] = useState('')
  const [filterType, setFilterType]     = useState('')
  const [fromDate, setFromDate]         = useState(new Date().toISOString().slice(0, 8) + '01')
  const [toDate, setToDate]             = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    fetchPartners()
    fetchTransactions()
  }, [])

  async function fetchPartners() {
    const { data } = await supabase
      .from('partners')
      .select('id, name, phone, share_pct')
      .eq('is_active', true)
      .order('name')
    setPartners(data || [])
  }

  async function fetchTransactions() {
    setLoading(true)
    let query = supabase
      .from('partner_transactions')
      .select('id, entry_date, transaction_type, amount, purpose, notes, entered_at, partners(id, name), profiles(full_name)')
      .gte('entry_date', fromDate)
      .lte('entry_date', toDate)
      .order('entry_date', { ascending: false })
      .order('entered_at', { ascending: false })

    if (filterPartner) query = query.eq('partner_id', filterPartner)
    if (filterType)    query = query.eq('transaction_type', filterType)

    const { data, error } = await query
    if (error) toast.error('Failed to load')
    else setTransactions(data || [])
    setLoading(false)
  }

  function openModal(partnerId = '') {
    setForm({ ...EMPTY_FORM, partner_id: partnerId })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setForm(EMPTY_FORM)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.partner_id)  { toast.error('Select a partner'); return }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter valid amount'); return }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('partner_transactions').insert({
      partner_id:       form.partner_id,
      entry_date:       form.entry_date,
      transaction_type: form.transaction_type,
      amount:           parseFloat(form.amount),
      purpose:          form.purpose || null,
      notes:            form.notes   || null,
      entered_by:       user?.id,
      entered_at:       new Date().toISOString(),
    })

    if (error) toast.error('Failed: ' + error.message)
    else {
      toast.success('Transaction saved')
      closeModal()
      fetchTransactions()
    }
    setSaving(false)
  }

  async function deleteTransaction(id) {
    if (!confirm('Delete this transaction?')) return
    const { error } = await supabase.from('partner_transactions').delete().eq('id', id)
    if (error) toast.error('Failed')
    else { toast.success('Deleted'); fetchTransactions() }
  }

  // ── Per-partner balance summary ───────────────────────────
  function getPartnerBalance(partnerId) {
    const txs = transactions.filter(t => t.partners?.id === partnerId)
    let given = 0, taken = 0, loanOut = 0, loanIn = 0, loanRepaid = 0
    txs.forEach(t => {
      const amt = parseFloat(t.amount || 0)
      if (t.transaction_type === 'given')       given      += amt
      if (t.transaction_type === 'taken')       taken      += amt
      if (t.transaction_type === 'loan_given')  loanOut    += amt
      if (t.transaction_type === 'loan_taken')  loanIn     += amt
      if (t.transaction_type === 'loan_repaid') loanRepaid += amt
    })
    return { given, taken, loanOut, loanIn, loanRepaid, net: taken - given }
  }

  const COLORS = ['var(--brand)', 'var(--blue)', 'var(--green)', 'var(--yellow)']

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Partner Transactions</div>
          <div className="page-subtitle">Track money given, taken and loans between partners</div>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <Plus size={15} /> Add Transaction
        </button>
      </div>

      {/* Partner balance cards */}
      <div className="partners-grid">
        {partners.map((p, i) => {
          const bal = getPartnerBalance(p.id)
          return (
            <div key={p.id} className="partner-bal-card">
              <div className="partner-bal-header">
                <div className="partner-avatar" style={{
                  background: COLORS[i % COLORS.length] + '22',
                  color:      COLORS[i % COLORS.length],
                  border:     `1px solid ${COLORS[i % COLORS.length]}44`
                }}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="partner-name">{p.name}</div>
                  <div className="partner-share">{p.share_pct}% share</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => openModal(p.id)}>
                  <Plus size={12} /> Add
                </button>
              </div>

              <div className="bal-stats">
                <div className="bal-stat">
                  <span className="bal-stat-label">Given Out</span>
                  <span className="bal-stat-val text-red">₹{bal.given.toLocaleString('en-IN')}</span>
                </div>
                <div className="bal-stat">
                  <span className="bal-stat-label">Taken In</span>
                  <span className="bal-stat-val text-green">₹{bal.taken.toLocaleString('en-IN')}</span>
                </div>
                <div className="bal-stat">
                  <span className="bal-stat-label">Loan Out</span>
                  <span className="bal-stat-val text-yellow">₹{bal.loanOut.toLocaleString('en-IN')}</span>
                </div>
                <div className="bal-stat">
                  <span className="bal-stat-label">Loan In</span>
                  <span className="bal-stat-val text-blue">₹{bal.loanIn.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="net-balance" style={{
                background: bal.net >= 0 ? 'var(--green-dim)' : 'var(--red-dim)',
                borderColor: bal.net >= 0 ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)',
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Net Balance</span>
                <span style={{
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18,
                  color: bal.net >= 0 ? 'var(--green)' : 'var(--red)'
                }}>
                  {bal.net >= 0 ? '+' : ''}₹{bal.net.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: 16, marginBottom: 20, marginTop: 28 }}>
        <div className="filters-row">
          <div className="filter-field">
            <label className="label">From</label>
            <div className="date-wrap">
              <Calendar size={13} className="date-icon" />
              <input type="date" className="input date-input" value={fromDate}
                onChange={e => setFromDate(e.target.value)} />
            </div>
          </div>
          <div className="filter-field">
            <label className="label">To</label>
            <div className="date-wrap">
              <Calendar size={13} className="date-icon" />
              <input type="date" className="input date-input" value={toDate}
                onChange={e => setToDate(e.target.value)} />
            </div>
          </div>
          <div className="filter-field" style={{ minWidth: 160 }}>
            <label className="label">Partner</label>
            <select className="input" value={filterPartner}
              onChange={e => setFilterPartner(e.target.value)}>
              <option value="">All Partners</option>
              {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="filter-field" style={{ minWidth: 160 }}>
            <label className="label">Type</label>
            <select className="input" value={filterType}
              onChange={e => setFilterType(e.target.value)}>
              <option value="">All Types</option>
              {TX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }} onClick={fetchTransactions}>
            <Search size={14} /> Search
          </button>
        </div>
      </div>

      {/* Transactions table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Partner</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Purpose</th>
              <th>Entered By</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}>
                <div className="table-loading"><Loader2 size={20} className="spin" /> Loading…</div>
              </td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan={7}>
                <div className="empty-state">
                  <HandCoins size={28} /><p>No transactions in this range</p>
                </div>
              </td></tr>
            ) : (
              transactions.map(tx => {
                const type = TX_TYPES.find(t => t.value === tx.transaction_type)
                return (
                  <tr key={tx.id}>
                    <td style={{ fontWeight: 500 }}>
                      {new Date(tx.entry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ fontWeight: 500 }}>{tx.partners?.name}</td>
                    <td>
                      {type && (
                        <span className="type-badge" style={{
                          background: type.color + '18',
                          color:      type.color,
                          border:     `1px solid ${type.color}33`
                        }}>
                          <type.icon size={11} />
                          {type.label}
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
                        color: type?.dir === 'in' ? 'var(--green)' : 'var(--red)'
                      }}>
                        {type?.dir === 'in' ? '+' : '-'}₹{parseFloat(tx.amount).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>{tx.purpose || <span className="text-faint">—</span>}</td>
                    <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{tx.profiles?.full_name || '—'}</td>
                    <td>
                      <button className="delete-btn" onClick={() => deleteTransaction(tx.id)}>
                        <X size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Transaction Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>
                  Add Partner Transaction
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                  Record money given, taken or loan
                </div>
              </div>
              <button className="modal-close" onClick={closeModal}><X size={16} /></button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body">
                {/* Partner */}
                <div className="form-group">
                  <label className="label">Partner *</label>
                  <select className="input" value={form.partner_id}
                    onChange={e => setForm(f => ({ ...f, partner_id: e.target.value }))} required>
                    <option value="">— Select partner —</option>
                    {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                {/* Transaction type */}
                <div className="form-group">
                  <label className="label">Transaction Type *</label>
                  <div className="type-grid">
                    {TX_TYPES.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        className={`type-btn ${form.transaction_type === t.value ? 'type-btn-active' : ''}`}
                        style={form.transaction_type === t.value ? {
                          background:  t.color + '18',
                          borderColor: t.color + '55',
                          color:       t.color,
                        } : {}}
                        onClick={() => setForm(f => ({ ...f, transaction_type: t.value }))}
                      >
                        <t.icon size={13} />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid-2">
                  {/* Amount */}
                  <div className="form-group">
                    <label className="label">Amount (₹) *</label>
                    <div className="amount-wrap">
                      <span className="rupee">₹</span>
                      <input className="input" type="number" style={{ paddingLeft: 28 }}
                        placeholder="0" min="1" step="1"
                        value={form.amount}
                        onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                        required autoFocus />
                    </div>
                  </div>

                  {/* Date */}
                  <div className="form-group">
                    <label className="label">Date *</label>
                    <input className="input" type="date"
                      value={form.entry_date}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} />
                  </div>
                </div>

                {/* Purpose */}
                <div className="form-group">
                  <label className="label">Purpose</label>
                  <input className="input" placeholder="e.g. Machinery purchase, Business expense…"
                    value={form.purpose}
                    onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} />
                </div>

                {/* Notes */}
                <div className="form-group">
                  <label className="label">Notes</label>
                  <input className="input" placeholder="Additional notes…"
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving
                    ? <><Loader2 size={14} className="spin" /> Saving…</>
                    : <><Save size={14} /> Save Transaction</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .partners-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 16px; margin-bottom: 8px;
        }
        .partner-bal-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); padding: 20px;
          display: flex; flex-direction: column; gap: 14px;
        }
        .partner-bal-header { display: flex; align-items: center; gap: 12px; }
        .partner-avatar {
          width: 40px; height: 40px; border-radius: var(--r-md);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display); font-size: 18px; font-weight: 700; flex-shrink: 0;
        }
        .partner-name { font-weight: 600; font-size: 15px; }
        .partner-share { font-size: 11px; color: var(--text-3); margin-top: 2px; }

        .bal-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .bal-stat {
          background: var(--surface-2); border: 1px solid var(--border);
          border-radius: var(--r-sm); padding: 10px 12px;
        }
        .bal-stat-label { display: block; font-size: 10px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
        .bal-stat-val { font-family: var(--font-display); font-size: 15px; font-weight: 700; }

        .net-balance {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 14px; border-radius: var(--r-md); border: 1px solid;
        }

        .filters-row { display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap; }
        .filter-field { display: flex; flex-direction: column; gap: 4px; }
        .date-wrap { position: relative; }
        .date-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--text-3); pointer-events: none; }
        .date-input { padding-left: 32px; min-width: 150px; }

        .type-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 10px; border-radius: 99px;
          font-size: 11px; font-weight: 600;
        }

        .table-loading { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 40px; color: var(--text-3); }
        .delete-btn {
          width: 28px; height: 28px; border-radius: var(--r-sm);
          background: none; border: 1px solid transparent;
          color: var(--text-3); cursor: pointer;
          display: flex; align-items: center; justify-content: center; transition: all 0.12s;
        }
        .delete-btn:hover { background: var(--red-dim); border-color: rgba(248,113,113,0.25); color: var(--red); }

        /* Modal */
        .type-grid { display: flex; flex-direction: column; gap: 6px; }
        .type-btn {
          display: flex; align-items: center; gap: 8px;
          padding: 9px 14px; border-radius: var(--r-sm);
          background: var(--surface-2); border: 1px solid var(--border);
          color: var(--text-2); font-size: 13px; font-family: var(--font-body);
          cursor: pointer; transition: all 0.14s; text-align: left;
        }
        .type-btn:hover { background: var(--surface-3); color: var(--text); }
        .type-btn-active { font-weight: 600; }
        .amount-wrap { position: relative; }
        .rupee { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); font-size: 14px; color: var(--text-3); }
        .modal-close { width: 32px; height: 32px; border-radius: var(--r-sm); background: var(--surface-2); border: 1px solid var(--border); color: var(--text-2); cursor: pointer; display: flex; align-items: center; justify-content: center; }

        :global(.spin) { animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 1100px) {

  .partners-grid {
    grid-template-columns: 1fr 1fr;
  }

  .filters-row {
    grid-template-columns: repeat(2, 1fr);
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

  .partners-grid {
    grid-template-columns: 1fr;
  }

  .filters-row {
    grid-template-columns: 1fr;
  }

  .filter-field {
    min-width: 100% !important;
  }

  .table-wrap {
    overflow-x: auto;
  }

  table {
    min-width: 900px;
  }

  .modal {
    width: calc(100vw - 24px);
    max-height: 90vh;
    overflow-y: auto;
  }

  .type-grid {
    grid-template-columns: 1fr;
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

  .partner-bal-card {
    padding: 14px;
  }

  .bal-stats {
    grid-template-columns: 1fr 1fr;
  }

  .partner-name {
    font-size: 14px;
  }

  .net-balance {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
}
      `}</style>
    </div>
  )
}