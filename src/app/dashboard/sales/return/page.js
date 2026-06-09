'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, Save, Loader2,
  Calendar, X, RotateCcw, AlertTriangle
} from 'lucide-react'

const RETURN_REASONS = ['Defective', 'Expired', 'Damaged in Transit', 'Wrong Product', 'Quality Issue', 'Other']

export default function ReturnEntryPage() {
  const [distributors, setDistributors] = useState([])
  const [products, setProducts]         = useState([])
  const [saving, setSaving]             = useState(false)
  const [date, setDate]                 = useState(new Date().toISOString().split('T')[0])
  const [distributorId, setDistributorId] = useState('')
  const [rows, setRows]                 = useState([{ product_id: '', quantity: '', unit_price: '', reason: 'Defective', notes: '' }])
  const [returnNotes, setReturnNotes]   = useState('')
  const [recentReturns, setRecentReturns] = useState([])

  useEffect(() => {
    fetchDistributors()
    fetchProducts()
    fetchRecentReturns(date)
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

  async function fetchRecentReturns(forDate) {
    const { data } = await supabase
      .from('product_returns')
      .select(`
        id, entry_date, total_amount, return_reason, notes,
        distributors(name),
        product_return_items(
          id, quantity, unit_price, total_amount,
          products(name, unit)
        )
      `)
      .eq('entry_date', forDate)
      .order('entered_at', { ascending: false })
    setRecentReturns(data || [])
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
    if (!distributorId) { toast.error('Select a distributor'); return }
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
      return_id:  ret.id,
      product_id: r.product_id,
      quantity:   parseFloat(r.quantity),
      unit_price: parseFloat(r.unit_price),
      total_amount: parseFloat(r.quantity) * parseFloat(r.unit_price),
      reason:     r.reason,
      notes:      r.notes || null,
    }))

    const { error: itemsError } = await supabase.from('product_return_items').insert(items)
    if (itemsError) {
      await supabase.from('product_returns').delete().eq('id', ret.id)
      toast.error('Failed to save items: ' + itemsError.message)
      setSaving(false)
      return
    }

    // 3. Create expense entry so it reduces profit
    const dist = distributors.find(d => d.id === distributorId)

    // Get or create "Product Returns" expense category
    let categoryId = null
    const { data: existingCat } = await supabase
      .from('expense_categories')
      .select('id')
      .eq('name', 'Product Returns')
      .single()

    if (existingCat) {
      categoryId = existingCat.id
    } else {
      const { data: newCat } = await supabase
        .from('expense_categories')
        .insert({ name: 'Product Returns', created_by: user?.id })
        .select('id')
        .single()
      categoryId = newCat?.id || null
    }

    const productNames = validRows.map(r => {
      const p = products.find(pr => pr.id === r.product_id)
      return `${p?.name || 'Product'} (${parseFloat(r.quantity)} ${p?.unit || ''})`
    }).join(', ')

    const { data: expense, error: expError } = await supabase
      .from('daily_expenses')
      .insert({
        entry_date:  date,
        category_id: categoryId,
        amount:      returnTotal,
        notes:       `Return from ${dist?.name || 'distributor'}: ${productNames}`,
        entered_by:  user?.id,
        entered_at:  new Date().toISOString(),
      })
      .select('id')
      .single()

    if (!expError && expense) {
      // Link expense back to return
      await supabase
        .from('product_returns')
        .update({ expense_id: expense.id })
        .eq('id', ret.id)
    }

    toast.success(`Return saved · ₹${returnTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} logged as expense`)
    setRows([{ product_id: '', quantity: '', unit_price: '', reason: 'Defective', notes: '' }])
    setDistributorId('')
    setReturnNotes('')
    fetchRecentReturns(date)
    setSaving(false)
  }

  async function deleteReturn(id) {
    if (!confirm('Delete this return? The linked expense will also be deleted.')) return

    // Get expense_id first
    const { data: ret } = await supabase
      .from('product_returns')
      .select('expense_id')
      .eq('id', id)
      .single()

    // Delete items
    await supabase.from('product_return_items').delete().eq('return_id', id)

    // Delete linked expense
    if (ret?.expense_id) {
      await supabase.from('daily_expenses').delete().eq('id', ret.expense_id)
    }

    // Delete return
    const { error } = await supabase.from('product_returns').delete().eq('id', id)
    if (error) toast.error('Failed to delete')
    else { toast.success('Return deleted'); fetchRecentReturns(date) }
  }

  const todayTotal = recentReturns.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Return Entry</div>
          <div className="page-subtitle">Defective / expired / damaged returns — logged as expense, reduces profit</div>
        </div>
        <div className="date-wrap">
          <Calendar size={13} className="date-icon" />
          <input type="date" className="input date-input"
            value={date}
            onChange={e => { setDate(e.target.value); fetchRecentReturns(e.target.value) }}
            max={new Date().toISOString().split('T')[0]} />
        </div>
      </div>

      {/* Info banner */}
      <div className="info-banner">
        <AlertTriangle size={14} />
        <span>Returns do <strong>not</strong> affect sales, invoices, payments, or outstanding balance. They are recorded as an expense to reduce net profit.</span>
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
              onChange={e => setDistributorId(e.target.value)}>
              <option value="">— Select distributor —</option>
              {distributors.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}{d.route ? ` (${d.route})` : ''}
                </option>
              ))}
            </select>
          </div>

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
              const product  = products.find(p => p.id === row.product_id)
              const rowTotal = (parseFloat(row.quantity) || 0) * (parseFloat(row.unit_price) || 0)
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
                <span className="text-muted" style={{ fontSize: 12 }}>Return Total (will be logged as expense)</span>
              </div>
              <span className="total-val">₹{returnTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
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
              <div className="today-total">
                ₹{todayTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>

          {recentReturns.length === 0 ? (
            <div className="empty-state" style={{ padding: '28px 0' }}>
              <RotateCcw size={28} />
              <p>No returns for this date</p>
            </div>
          ) : (
            <div className="today-list">
              {recentReturns.map(r => (
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
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                      {r.return_reason}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                    <span className="today-amount">
                      ₹{parseFloat(r.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
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
          border-radius: var(--r-md); padding: 12px 16px; margin-top: 16px;
        }
        .total-val {
          font-family: var(--font-display); font-size: 20px;
          font-weight: 700; color: var(--yellow);
        }
        .entry-footer {
          display: flex; align-items: center; justify-content: space-between;
          margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);
        }
        .audit-notice { font-size: 11px; color: var(--text-3); }

        /* Today panel */
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
          font-size: 14px; color: var(--yellow);
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
          .returns-layout { grid-template-columns: 1fr; }
        }

        @media (max-width: 768px) {
          .page-header { flex-direction: column; align-items: stretch; gap: 14px; }
          .date-wrap { width: 100%; }
          .date-input { width: 100%; }
          .row-headers { display: none; }
          .entry-row {
            grid-template-columns: 1fr;
            padding: 14px;
            border: 1px solid var(--border);
            border-radius: var(--r-md);
            background: var(--surface-2);
          }
          .remove-btn { width: 100%; height: 40px; }
          .entry-footer { flex-direction: column; align-items: stretch; gap: 12px; }
          .entry-footer .btn { width: 100%; justify-content: center; }
        }
      `}</style>
    </div>
  )
}