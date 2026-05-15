'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, FlaskConical, Save,
  Loader2, Calendar, ChevronDown, Info, X
} from 'lucide-react'

export default function ProductionEntryPage() {
  const [products, setProducts]   = useState([])
  const [loading, setLoading]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [date, setDate]           = useState(new Date().toISOString().split('T')[0])
  const [rows, setRows]           = useState([{ product_id: '', quantity: '', notes: '' }])
  const [todaySummary, setTodaySummary] = useState([])
  const [rawStatus, setRawStatus] = useState([]) // low-stock warnings after save

  useEffect(() => {
    fetchProducts()
    fetchTodaySummary(date)
  }, [])

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('id, name, unit, category')
      .eq('is_active', true)
      .order('name')
    setProducts(data || [])
  }

  async function fetchTodaySummary(forDate) {
    const { data } = await supabase
      .from('daily_production')
      .select('id, batch_no, quantity, notes, entered_at, products(name, unit)')
      .eq('entry_date', forDate)
      .order('entered_at', { ascending: false })
    setTodaySummary(data || [])
  }

  async function fetchRawMaterialStatus() {
    const { data } = await supabase
      .from('v_raw_material_stock')
      .select('name, current_stock, low_stock_alert, unit, is_low_stock')
      .eq('is_low_stock', true)
    setRawStatus(data || [])
  }

  // ── Row management ────────────────────────────────────────
  function addRow() {
    setRows(r => [...r, { product_id: '', quantity: '', notes: '' }])
  }

  function removeRow(i) {
    setRows(r => r.filter((_, idx) => idx !== i))
  }

  function updateRow(i, field, value) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: value } : row))
  }

  // ── Save ──────────────────────────────────────────────────
  async function handleSave() {
    // Validate
    const valid = rows.filter(r => r.product_id && r.quantity && parseFloat(r.quantity) > 0)
    if (valid.length === 0) {
      toast.error('Add at least one product with quantity')
      return
    }
    const hasEmpty = rows.some(r => (!r.product_id || !r.quantity) && rows.length > 1)
    if (hasEmpty) {
      toast.error('Fill in all rows or remove empty ones')
      return
    }

    setSaving(true)

    // Get session user + IP via server action
    const { data: { user } } = await supabase.auth.getUser()

    // Determine batch numbers for each product today
    const productBatchMap = {}
    todaySummary.forEach(s => {
      const pid = s.product_id || s.products?.id
      if (!productBatchMap[pid]) productBatchMap[pid] = 0
      productBatchMap[pid] = Math.max(productBatchMap[pid], s.batch_no || 1)
    })

    // Get current batch counts fresh from DB
    const { data: existingToday } = await supabase
      .from('daily_production')
      .select('product_id, batch_no')
      .eq('entry_date', date)

    const batchCount = {}
    ;(existingToday || []).forEach(e => {
      batchCount[e.product_id] = Math.max(batchCount[e.product_id] || 0, e.batch_no)
    })

    const insertRows = valid.map(r => ({
      entry_date:  date,
      product_id:  r.product_id,
      batch_no:    (batchCount[r.product_id] || 0) + 1,
      quantity:    parseFloat(r.quantity),
      notes:       r.notes || null,
      entered_by:  user?.id,
      entered_at:  new Date().toISOString(),
      ip_address:  null, // set server-side if needed
    }))

    const { error } = await supabase.from('daily_production').insert(insertRows)

    if (error) {
      toast.error('Failed to save: ' + error.message)
    } else {
      toast.success(`${insertRows.length} production ${insertRows.length === 1 ? 'entry' : 'entries'} saved!`)
      setRows([{ product_id: '', quantity: '', notes: '' }])
      fetchTodaySummary(date)
      fetchRawMaterialStatus() // check low stock after production
    }

    setSaving(false)
  }

  async function deleteEntry(id) {
    if (!confirm('Delete this production entry?')) return
    const { error } = await supabase.from('daily_production').delete().eq('id', id)
    if (error) toast.error('Failed to delete')
    else { toast.success('Entry deleted'); fetchTodaySummary(date) }
  }

  function handleDateChange(newDate) {
    setDate(newDate)
    fetchTodaySummary(newDate)
  }

  // Group today's summary by product
  const grouped = {}
  todaySummary.forEach(s => {
    const name = s.products?.name || 'Unknown'
    if (!grouped[name]) grouped[name] = { unit: s.products?.unit, batches: [], total: 0 }
    grouped[name].batches.push(s)
    grouped[name].total += parseFloat(s.quantity || 0)
  })

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Daily Production Entry</div>
          <div className="page-subtitle">Record how many units of each product were made</div>
        </div>
        <div className="date-picker-wrap">
          <Calendar size={14} className="date-icon" />
          <input
            type="date"
            className="input date-input"
            value={date}
            onChange={e => handleDateChange(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
          />
        </div>
      </div>

      {/* Low stock warning after save */}
      {rawStatus.length > 0 && (
        <div className="low-stock-warn">
          <Info size={15} />
          <div>
            <strong>Raw material stock is low after this production:</strong>{' '}
            {rawStatus.map(r => `${r.name} (${parseFloat(r.current_stock).toFixed(2)} ${r.unit} left)`).join(', ')}
          </div>
          <button onClick={() => setRawStatus([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', marginLeft: 'auto' }}>
            <X size={14} />
          </button>
        </div>
      )}

      <div className="production-layout">
        {/* Entry form */}
        <div className="entry-panel card">
          <div className="entry-panel-header">
            <FlaskConical size={16} color="var(--green)" />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
              Production Entry
            </span>
            <span className="batch-date-badge">
              {new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>

          {/* Column headers */}
          <div className="entry-row-headers">
            <span>Product *</span>
            <span>Quantity *</span>
            <span>Notes</span>
            <span></span>
          </div>

          {/* Rows */}
          <div className="entry-rows">
            {rows.map((row, i) => {
              const product = products.find(p => p.id === row.product_id)
              return (
                <div key={i} className="entry-row">
                  {/* Product select */}
                  <div className="entry-field">
                    <div className="custom-select-wrap">
                      <select
                        className="input"
                        value={row.product_id}
                        onChange={e => updateRow(i, 'product_id', e.target.value)}
                      >
                        <option value="">— Select product —</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.unit})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Quantity */}
                  <div className="entry-field entry-field-qty">
                    <div className="qty-input-wrap">
                      <input
                        type="number"
                        className="input"
                        placeholder="0"
                        min="0"
                        step="0.01"
                        value={row.quantity}
                        onChange={e => updateRow(i, 'quantity', e.target.value)}
                      />
                      {product && (
                        <span className="qty-unit">{product.unit}</span>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="entry-field entry-field-notes">
                    <input
                      type="text"
                      className="input"
                      placeholder="Optional note…"
                      value={row.notes}
                      onChange={e => updateRow(i, 'notes', e.target.value)}
                    />
                  </div>

                  {/* Remove */}
                  <button
                    className="remove-row-btn"
                    onClick={() => removeRow(i)}
                    disabled={rows.length === 1}
                    title="Remove row"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Add row + Save */}
          <div className="entry-actions">
            <button className="btn btn-ghost" onClick={addRow}>
              <Plus size={14} /> Add Another Product
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving
                ? <><Loader2 size={14} className="spin" /> Saving…</>
                : <><Save size={14} /> Save Production</>
              }
            </button>
          </div>

          <div className="audit-notice">
            Entry will be logged with your user ID, timestamp and IP address.
          </div>
        </div>

        {/* Today's summary */}
        <div className="summary-panel">
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="summary-header">
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>
                {new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — Production Summary
              </div>
              <span className="badge badge-green">{todaySummary.length} batches</span>
            </div>

            {Object.keys(grouped).length === 0 ? (
              <div className="empty-state" style={{ padding: '32px 0' }}>
                <FlaskConical size={28} />
                <p>No production entries for this date</p>
              </div>
            ) : (
              <div className="summary-list">
                {Object.entries(grouped).map(([name, data]) => (
                  <div key={name} className="summary-product">
                    <div className="summary-product-header">
                      <div className="summary-product-name">{name}</div>
                      <div className="summary-product-total">
                        {data.total.toLocaleString('en-IN')}
                        <span className="summary-unit">{data.unit}</span>
                      </div>
                    </div>

                    {/* Individual batches */}
                    {data.batches.map(b => (
                      <div key={b.id} className="summary-batch">
                        <span className="batch-badge">Batch {b.batch_no}</span>
                        <span className="batch-qty">{parseFloat(b.quantity).toLocaleString('en-IN')} {data.unit}</span>
                        {b.notes && <span className="batch-note">{b.notes}</span>}
                        <span className="batch-time">
                          {new Date(b.entered_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                          className="batch-delete"
                          onClick={() => deleteEntry(b.id)}
                          title="Delete this batch"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .production-layout {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 20px;
          align-items: start;
        }

        /* Date picker */
        .date-picker-wrap { position: relative; }
        .date-icon {
          position: absolute; left: 12px; top: 50%;
          transform: translateY(-50%);
          color: var(--text-3); pointer-events: none;
        }
        .date-input {
          padding-left: 36px;
          width: 190px;
          cursor: pointer;
        }

        /* Low stock warning */
        .low-stock-warn {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          background: var(--yellow-dim);
          border: 1px solid rgba(251,191,36,0.3);
          border-radius: var(--r-md);
          padding: 12px 16px;
          color: var(--yellow);
          font-size: 13px;
          margin-bottom: 16px;
          line-height: 1.5;
        }

        /* Entry panel */
        .entry-panel-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border);
        }
        .batch-date-badge {
          margin-left: auto;
          font-size: 12px;
          color: var(--text-3);
          background: var(--surface-2);
          padding: 3px 10px;
          border-radius: 99px;
          border: 1px solid var(--border);
        }

        /* Column headers */
        .entry-row-headers {
          display: grid;
          grid-template-columns: 1fr 160px 1fr 32px;
          gap: 10px;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-3);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 0 0 6px;
          margin-bottom: 4px;
        }

        /* Rows */
        .entry-rows { display: flex; flex-direction: column; gap: 10px; }
        .entry-row {
          display: grid;
          grid-template-columns: 1fr 160px 1fr 32px;
          gap: 10px;
          align-items: center;
        }
        .entry-field {}
        .entry-field-qty {}
        .qty-input-wrap { position: relative; }
        .qty-unit {
          position: absolute;
          right: 12px; top: 50%;
          transform: translateY(-50%);
          font-size: 11px;
          color: var(--text-3);
          pointer-events: none;
        }

        .remove-row-btn {
          width: 32px; height: 38px;
          border-radius: var(--r-sm);
          background: var(--surface-2);
          border: 1px solid var(--border);
          color: var(--text-3);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.14s;
          flex-shrink: 0;
        }
        .remove-row-btn:hover:not(:disabled) {
          background: var(--red-dim);
          border-color: rgba(248,113,113,0.3);
          color: var(--red);
        }
        .remove-row-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        .entry-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid var(--border);
        }

        .audit-notice {
          margin-top: 12px;
          font-size: 11px;
          color: var(--text-3);
          text-align: center;
        }

        /* Summary panel */
        .summary-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          padding-bottom: 14px;
          border-bottom: 1px solid var(--border);
        }

        .summary-list { display: flex; flex-direction: column; gap: 14px; }

        .summary-product {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          overflow: hidden;
        }
        .summary-product-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          background: var(--surface-3);
          border-bottom: 1px solid var(--border);
        }
        .summary-product-name {
          font-weight: 600;
          font-size: 13.5px;
        }
        .summary-product-total {
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 700;
          color: var(--green);
        }
        .summary-unit {
          font-size: 11px;
          font-family: var(--font-body);
          font-weight: 400;
          color: var(--text-3);
          margin-left: 3px;
        }

        .summary-batch {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 14px;
          border-bottom: 1px solid var(--border);
          font-size: 12.5px;
          color: var(--text-2);
        }
        .summary-batch:last-child { border-bottom: none; }

        .batch-badge {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: var(--brand-glow);
          color: var(--brand);
          padding: 2px 7px;
          border-radius: 99px;
          flex-shrink: 0;
        }
        .batch-qty {
          font-weight: 500;
          color: var(--text);
          flex-shrink: 0;
        }
        .batch-note {
          color: var(--text-3);
          font-style: italic;
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .batch-time {
          font-size: 11px;
          color: var(--text-3);
          margin-left: auto;
          flex-shrink: 0;
        }
        .batch-delete {
          background: none; border: none;
          color: var(--text-3); cursor: pointer;
          padding: 3px;
          border-radius: var(--r-sm);
          display: flex; align-items: center;
          transition: all 0.12s;
          flex-shrink: 0;
        }
        .batch-delete:hover { color: var(--red); background: var(--red-dim); }

        :global(.spin) { animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 1200px) {

  .production-layout {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .summary-panel {
    width: 100%;
  }
}

@media (max-width: 900px) {

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }

  .date-picker-wrap {
    width: 100%;
  }

  .date-input {
    width: 100%;
  }

  .entry-row {
    grid-template-columns: 1fr;
    gap: 10px;

    padding: 14px;
    border: 1px solid var(--border);
    border-radius: var(--r-md);

    background: var(--surface-2);
  }

  .entry-row-headers {
    display: none;
  }

  .entry-field-notes {
    display: block;
  }

  .entry-field-qty {
    width: 100%;
  }

  .remove-row-btn {
    width: 100%;
    height: 40px;
  }

  .entry-actions {
    flex-direction: column;
    gap: 10px;
  }

  .entry-actions .btn {
    width: 100%;
    justify-content: center;
  }

  .summary-batch {
    flex-wrap: wrap;
    gap: 8px;
  }

  .batch-time {
    margin-left: 0;
  }
}

@media (max-width: 640px) {

  .dashboard-content,
  .production-layout,
  .entry-panel,
  .summary-panel,
  .card {
    min-width: 0;
    width: 100%;
  }

  .page-title {
    font-size: 20px;
  }

  .page-subtitle {
    font-size: 13px;
  }

  .summary-product-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .summary-product-total {
    font-size: 15px;
  }

  .batch-note {
    width: 100%;
    white-space: normal;
  }

  .low-stock-warn {
    flex-direction: column;
    align-items: flex-start;
  }
}
      `}</style>
    </div>
  )
  }
