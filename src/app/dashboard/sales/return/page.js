'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, Save, Loader2,
  Calendar, X, RotateCcw, AlertTriangle, History
} from 'lucide-react'
import Link from 'next/link'

const RETURN_REASONS = ['Defective', 'Expired', 'Damaged in Transit', 'Wrong Product', 'Quality Issue', 'Other']

export default function ReturnEntryPage() {
  const [distributors, setDistributors] = useState([])
  const [products, setProducts]         = useState([])
  const [saving, setSaving]             = useState(false)
  const [date, setDate]                 = useState(new Date().toISOString().split('T')[0])
  const [distributorId, setDistributorId] = useState('')
  const [distributorBalance, setDistributorBalance] = useState(null)
  const [rows, setRows]                 = useState([{ product_id: '', quantity: '', unit_price: '', reason: 'Defective', notes: '' }])
  const [returnNotes, setReturnNotes]   = useState('')
  const [todayReturns, setTodayReturns] = useState([])

  useEffect(() => {
    fetchDistributors()
    fetchProducts()
    fetchTodayReturns(date)
  }, [])

  async function fetchDistributors() {
    const { data } = await supabase
      .from('distributors')
      .select('id, name, phone, route')
      .eq('is_active', true)
      .order('name')
    setDistributors(data || [])
  }

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('id, name, unit, sale_price')
      .eq('is_active', true)
      .order('name')
    setProducts(data || [])
  }

  async function fetchTodayReturns(forDate) {
    const { data } = await supabase
      .from('product_returns')
      .select(`
        id, entry_date, total_amount, return_reason, notes, entered_at,
        distributors(name),
        product_return_items(
          id, quantity, unit_price, total_amount, reason,
          products(name, unit)
        )
      `)
      .eq('entry_date', forDate)
      .order('entered_at', { ascending: false })
    setTodayReturns(data || [])
  }

  async function handleDistributorChange(distId) {
    setDistributorId(distId)
    setDistributorBalance(null)
    if (!distId) return
    const { data } = await supabase
      .from('v_distributor_balance')
      .select('total_billed, total_paid, total_returned, outstanding')
      .eq('distributor_id', distId)
      .single()
    setDistributorBalance(data || null)
  }

  function addRow() {
    setRows(r => [...r, { product_id: '', quantity: '', unit_price: '', reason: 'Defective', notes: '' }])
  }

  function removeRow(i) {
    setRows(r => r.filter((_, idx) => idx !== i))
  }

  function updateRow(i, field, value) {
    setRows(prev => prev.map((row, idx) => {
      if (idx !== i) return row
      const updated = { ...row, [field]: value }
      if (field === 'product_id' && value) {
        const p = products.find(pr => pr.id === value)
        if (p) updated.unit_price = p.sale_price
      }
      return updated
    }))
  }

  const validRows = rows.filter(r =>
    r.product_id && r.quantity && r.unit_price &&
    parseFloat(r.quantity) > 0 && parseFloat(r.unit_price) > 0
  )

  const returnTotal = validRows.reduce((s, r) =>
    s + parseFloat(r.quantity || 0) * parseFloat(r.unit_price || 0), 0)

  async function handleSave() {
    if (!distributorId)        { toast.error('Select a distributor'); return }
    if (validRows.length === 0) { toast.error('Add at least one product with quantity and price'); return }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    // 1. Insert return header
    const { data: ret, error: retError } = await supabase
      .from('product_returns')
      .insert({
        entry_date:     date,
        distributor_id: distributorId,
        total_amount:   returnTotal,
        return_reason:  validRows[0]?.reason || 'Defective',
        notes:          returnNotes || null,
        entered_by:     user?.id,
        entered_at:     new Date().toISOString(),
      })
      .select()
      .single()

    if (retError) { toast.error('Failed to save return: ' + retError.message); setSaving(false); return }

    // 2. Insert return items
    const items = validRows.map(r => ({
      return_id:    ret.id,
      product_id:   r.product_id,
      quantity:     parseFloat(r.quantity),
      unit_price:   parseFloat(r.unit_price),
      total_amount: parseFloat(r.quantity) * parseFloat(r.unit_price),
      reason:       r.reason,
      notes:        r.notes || null,
    }))

    const { error: itemsError } = await supabase.from('product_return_items').insert(items)

    if (itemsError) {
      await supabase.from('product_returns').delete().eq('id', ret.id)
      toast.error('Failed to save items: ' + itemsError.message)
      setSaving(false)
      return
    }

    const dist = distributors.find(d => d.id === distributorId)
    toast.success(`Return saved · ₹${returnTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} deducted from ${dist?.name}'s outstanding`)

    setRows([{ product_id: '', quantity: '', unit_price: '', reason: 'Defective', notes: '' }])
    setDistributorId('')
    setDistributorBalance(null)
    setReturnNotes('')
    fetchTodayReturns(date)
    // Refresh balance
    if (distributorId) handleDistributorChange(distributorId)
    setSaving(false)
  }

  async function deleteReturn(id) {
    if (!confirm('Delete this return? The outstanding balance will be restored.')) return
    await supabase.from('product_return_items').delete().eq('return_id', id)
    const { error } = await supabase.from('product_returns').delete().eq('id', id)
    if (error) toast.error('Failed to delete')
    else { toast.success('Return deleted · outstanding restored'); fetchTodayReturns(date) }
  }

  const fmt = n => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  const todayTotal = todayReturns.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Return Entry</div>
          <div className="page-subtitle">Defective / expired / damaged — deducted from distributor outstanding</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/dashboard/sales/return/history" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
            <History size={14} /> Return History
          </Link>
          <div className="date-wrap">
            <Calendar size={13} className="date-icon" />
            <input type="date" className="input date-input"
              value={date}
              onChange={e => { setDate(e.target.value); fetchTodayReturns(e.target.value) }}
              max={new Date().toISOString().split('T')[0]} />
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="info-banner">
        <AlertTriangle size={14} />
        <span>
          Returns reduce the distributor's outstanding balance. Sales, invoices and payment records are <strong>not</strong> affected.
        </span>
      </div>

      <div className="returns-layout">
        {/* Entry form */}
        <div className="card entry-card">
          <div className="entry-header">
            <RotateCcw size={16} color="var(--yellow)" />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>New Return Entry</span>
          </div>

          {/* Distributor */}
          <div className="form-group">
            <label className="label">Distributor *</label>
            <select className="input" value={distributorId}
              onChange={e => handleDistributorChange(e.target.value)}>
              <option value="">— Select distributor —</option>
              {distributors.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}{d.route ? ` (${d.route})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Balance info */}
          {distributorBalance && (
            <div className="balance-info">
              <div className="balance-row">
                <span className="text-muted">Total Billed</span>
                <span style={{ fontWeight: 600, color: 'var(--blue)' }}>{fmt(distributorBalance.total_billed)}</span>
              </div>
              <div className="balance-row">
                <span className="text-muted">Payments Collected</span>
                <span style={{ fontWeight: 600, color: 'var(--green)' }}>{fmt(distributorBalance.total_paid)}</span>
              </div>
              {parseFloat(distributorBalance.total_returned || 0) > 0 && (
                <div className="balance-row">
                  <span className="text-muted">Previous Returns</span>
                  <span style={{ fontWeight: 600, color: 'var(--yellow)' }}>− {fmt(distributorBalance.total_returned)}</span>
                </div>
              )}
              <div className="balance-row balance-total">
                <span style={{ fontWeight: 700 }}>Current Outstanding</span>
                <span style={{
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18,
                  color: parseFloat(distributorBalance.outstanding) > 0 ? 'var(--red)' : 'var(--green)'
                }}>
                  {fmt(distributorBalance.outstanding)}
                </span>
              </div>
              {returnTotal > 0 && (
                <div className="balance-row" style={{ marginTop: 4, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
                  <span className="text-muted">After This Return</span>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
                    color: (parseFloat(distributorBalance.outstanding) - returnTotal) >= 0 ? 'var(--green)' : 'var(--red)'
                  }}>
                    {fmt(parseFloat(distributorBalance.outstanding) - returnTotal)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Row headers */}
          <div className="row-headers">
            <span>Product *</span>
            <span>Qty *</span>
            <span>Unit Price (₹) *</span>
            <span>Reason</span>
            <span>Note</span>
            <span></span>
          </div>

          <div className="entry-rows">
            {rows.map((row, i) => {
              const product = products.find(p => p.id === row.product_id)
              return (
                <div key={i} className="entry-row">
                  <select className="input" value={row.product_id}
                    onChange={e => updateRow(i, 'product_id', e.target.value)}>
                    <option value="">— Select —</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                    ))}
                  </select>

                  <div className="qty-wrap">
                    <input type="number" className="input" placeholder="0"
                      min="0" step="0.01" value={row.quantity}
                      onChange={e => updateRow(i, 'quantity', e.target.value)} />
                    {product && <span className="qty-unit">{product.unit}</span>}
                  </div>

                  <div className="price-wrap">
                    <span className="price-rupee">₹</span>
                    <input type="number" className="input price-input" placeholder="0.00"
                      min="0" step="0.01" value={row.unit_price}
                      onChange={e => updateRow(i, 'unit_price', e.target.value)} />
                  </div>

                  <select className="input" value={row.reason}
                    onChange={e => updateRow(i, 'reason', e.target.value)}>
                    {RETURN_REASONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>

                  <input type="text" className="input" placeholder="Note…"
                    value={row.notes}
                    onChange={e => updateRow(i, 'notes', e.target.value)} />

                  <button className="remove-btn" onClick={() => removeRow(i)}
                    disabled={rows.length === 1}>
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
          </div>

          <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={addRow}>
            <Plus size={14} /> Add Product
          </button>

          <div className="form-group" style={{ marginTop: 16 }}>
            <label className="label">Return Notes (optional)</label>
            <input className="input" placeholder="Overall note for this return…"
              value={returnNotes} onChange={e => setReturnNotes(e.target.value)} />
          </div>

          {returnTotal > 0 && (
            <div className="total-bar">
              <div>
                <div style={{ fontSize: 11, color: 'var(--yellow)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Return Total</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Will be deducted from distributor outstanding</div>
              </div>
              <span className="total-val">{fmt(returnTotal)}</span>
            </div>
          )}

          <div className="entry-footer">
            <div className="audit-notice">Saved with user ID · timestamp</div>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving
                ? <><Loader2 size={14} className="spin" /> Saving…</>
                : <><Save size={14} /> Save Return</>
              }
            </button>
          </div>
        </div>

        {/* Today's returns sidebar */}
        <div className="card today-card">
          <div className="today-header">
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>Today's Returns</div>
            {todayTotal > 0 && (
              <div className="today-total">{fmt(todayTotal)}</div>
            )}
          </div>

          {todayReturns.length === 0 ? (
            <div className="empty-state" style={{ padding: '28px 0' }}>
              <RotateCcw size={28} />
              <p>No returns for this date</p>
            </div>
          ) : (
            <div className="today-list">
              {todayReturns.map(r => (
                <div key={r.id} className="today-row">
                  <div className="today-row-info">
                    <div className="today-dist">{r.distributors?.name}</div>
                    <div className="today-items">
                      {r.product_return_items?.map(i => (
                        <span key={i.id} className="today-item-chip">
                          {i.products?.name} × {parseFloat(i.quantity)}{i.products?.unit}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>
                      {r.return_reason}
                      {r.notes && ` · ${r.notes}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                    <span className="today-amount">{fmt(r.total_amount)}</span>
                    <button className="delete-btn" onClick={() => deleteReturn(r.id)}>
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .returns-layout {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 20px;
          align-items: start;
        }
        .date-wrap { position: relative; }
        .date-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-3); pointer-events: none; }
        .date-input { padding-left: 36px; width: 180px; }

        .info-banner {
          display: flex; align-items: center; gap: 10px;
          background: var(--yellow-dim); border: 1px solid rgba(251,191,36,0.3);
          border-radius: var(--r-md); padding: 11px 16px;
          color: var(--yellow); font-size: 13px; margin-bottom: 20px;
        }

        .entry-header {
          display: flex; align-items: center; gap: 10px;
          padding-bottom: 16px; margin-bottom: 16px;
          border-bottom: 1px solid var(--border);
        }
        .form-group { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }

        .balance-info {
          background: var(--surface-2); border: 1px solid var(--border);
          border-radius: var(--r-md); padding: 14px 16px;
          margin-bottom: 16px; display: flex; flex-direction: column; gap: 8px;
        }
        .balance-row { display: flex; align-items: center; justify-content: space-between; font-size: 13px; }
        .balance-total { padding-top: 8px; border-top: 1px solid var(--border); margin-top: 4px; }

        .row-headers {
          display: grid;
          grid-template-columns: 1fr 110px 140px 150px 1fr 32px;
          gap: 8px;
          font-size: 11px; font-weight: 600;
          color: var(--text-3); text-transform: uppercase;
          letter-spacing: 0.06em; margin-bottom: 6px;
        }
        .entry-rows { display: flex; flex-direction: column; gap: 8px; }
        .entry-row {
          display: grid;
          grid-template-columns: 1fr 110px 140px 150px 1fr 32px;
          gap: 8px; align-items: center;
        }
        .qty-wrap { position: relative; }
        .qty-unit {
          position: absolute; right: 10px; top: 50%;
          transform: translateY(-50%); font-size: 11px;
          color: var(--text-3); pointer-events: none;
        }
        .price-wrap { position: relative; display: flex; align-items: center; }
        .price-rupee {
          position: absolute; left: 11px; font-size: 13px;
          color: var(--text-3); pointer-events: none; z-index: 1;
        }
        .price-input { padding-left: 24px; }
        .remove-btn {
          width: 32px; height: 38px; border-radius: var(--r-sm);
          background: var(--surface-2); border: 1px solid var(--border);
          color: var(--text-3); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.14s;
        }
        .remove-btn:hover:not(:disabled) { background: var(--red-dim); color: var(--red); }
        .remove-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        .total-bar {
          display: flex; align-items: center; justify-content: space-between;
          background: var(--yellow-dim); border: 1px solid rgba(251,191,36,0.3);
          border-radius: var(--r-md); padding: 14px 16px; margin-top: 16px;
        }
        .total-val {
          font-family: var(--font-display); font-size: 22px;
          font-weight: 700; color: var(--yellow);
        }
        .entry-footer {
          display: flex; align-items: center; justify-content: space-between;
          margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);
        }
        .audit-notice { font-size: 11px; color: var(--text-3); }

        .today-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid var(--border);
        }
        .today-total {
          font-family: var(--font-display); font-size: 18px;
          font-weight: 700; color: var(--yellow);
        }
        .today-list { display: flex; flex-direction: column; gap: 8px; }
        .today-row {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 10px; padding: 10px 12px;
          background: var(--surface-2); border: 1px solid var(--border);
          border-radius: var(--r-sm);
        }
        .today-row-info { flex: 1; min-width: 0; }
        .today-dist { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
        .today-items { display: flex; flex-wrap: wrap; gap: 4px; }
        .today-item-chip {
          font-size: 11px; padding: 2px 8px;
          background: var(--surface-3); border: 1px solid var(--border);
          border-radius: 99px; color: var(--text-2);
        }
        .today-amount {
          font-family: var(--font-display); font-weight: 700;
          font-size: 14px; color: var(--yellow); white-space: nowrap;
        }
        .delete-btn {
          width: 24px; height: 24px; border-radius: var(--r-sm);
          background: none; border: none; color: var(--text-3);
          cursor: pointer; display: flex; align-items: center;
          justify-content: center; transition: all 0.12s;
        }
        .delete-btn:hover { background: var(--red-dim); color: var(--red); }

        :global(.spin) { animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 1100px) {
          .row-headers { grid-template-columns: 1fr 110px 130px 130px 32px; }
          .entry-row   { grid-template-columns: 1fr 110px 130px 130px 32px; }
          .row-headers > span:nth-child(5),
          .entry-row > input[placeholder="Note…"] { display: none; }
        }
        @media (max-width: 1024px) {

          .returns-layout {
            grid-template-columns: 1fr;
          }

          .today-card {
            order: -1;
          }

          .row-headers {
            grid-template-columns: 1fr 90px 120px 120px 32px;
          }

          .entry-row {
            grid-template-columns: 1fr 90px 120px 120px 32px;
          }

          .row-headers > span:nth-child(5) {
            display: none;
          }

          .entry-row input[placeholder="Note…"] {
            display: none;
          }

        }
        @media (max-width:768px){

  .page-header{
    flex-direction:column;
    align-items:stretch;
    gap:14px;
  }

  .page-header > div:last-child{
    flex-direction:column;
    gap:12px;
  }

  .page-header .btn{
    width:100%;
    justify-content:center;
  }

  .date-wrap,
  .date-input{
    width:100%;
  }

  .returns-layout{
    grid-template-columns:1fr;
    gap:16px;
  }

  .today-card{
    order:-1;
  }

  /* Keep rows compact instead of cards */

  .row-headers{
    display:grid;
    grid-template-columns:1fr 80px 100px 100px 32px;
    gap:6px;
    font-size:10px;
  }

  .entry-row{
    display:grid;
    grid-template-columns:1fr 80px 100px 100px 32px;
    gap:6px;
    align-items:center;
  }

  /* hide notes column */

  .row-headers > span:nth-child(5),
  .entry-row input[placeholder="Note…"]{
    display:none;
  }

  .qty-unit{
    display:none;
  }

  .total-bar{
    flex-direction:column;
    gap:10px;
    text-align:center;
  }

  .entry-footer{
    flex-direction:column;
    gap:14px;
    align-items:stretch;
  }

  .entry-footer .btn{
    width:100%;
    justify-content:center;
  }

  .today-row{
    flex-direction:column;
  }

  .today-row > div:last-child{
    width:100%;
    flex-direction:row;
    justify-content:space-between;
    align-items:center;
  }

}
        @media (max-width: 480px) {

          .balance-info {
            padding: 12px;
          }

          .balance-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }

          .balance-total {
            gap: 6px;
          }

          .today-item-chip {
            font-size: 10px;
          }

          .total-val {
            font-size: 18px;
          }

        }
      `}</style>
    </div>
  )
}