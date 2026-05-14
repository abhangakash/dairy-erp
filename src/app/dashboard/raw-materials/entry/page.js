'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Plus, Trash2, Package, Save, Loader2, Calendar, IndianRupee, Truck } from 'lucide-react'

export default function StockEntryPage() {
  const [materials, setMaterials] = useState([])
  const [saving, setSaving]       = useState(false)
  const [date, setDate]           = useState(new Date().toISOString().split('T')[0])
  const [rows, setRows]           = useState([{ raw_material_id: '', quantity: '', unit_price: '', supplier: '' }])

  useEffect(() => { fetchMaterials() }, [])

  async function fetchMaterials() {
    const { data } = await supabase
      .from('raw_materials')
      .select('id, name, unit, current_stock')
      .eq('is_active', true)
      .order('name')
    setMaterials(data || [])
  }

  function addRow() {
    setRows(r => [...r, { raw_material_id: '', quantity: '', unit_price: '', supplier: '' }])
  }

  function removeRow(i) {
    setRows(r => r.filter((_, idx) => idx !== i))
  }

  function updateRow(i, field, value) {
    setRows(prev => prev.map((row, idx) => idx === i ? { ...row, [field]: value } : row))
  }

  async function handleSave() {
    const valid = rows.filter(r => r.raw_material_id && r.quantity && parseFloat(r.quantity) > 0)
    if (valid.length === 0) { toast.error('Add at least one material with quantity'); return }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    const inserts = valid.map(r => ({
      raw_material_id: r.raw_material_id,
      entry_date:      date,
      quantity:        parseFloat(r.quantity),
      unit_price:      r.unit_price ? parseFloat(r.unit_price) : null,
      supplier:        r.supplier || null,
      entered_by:      user?.id,
      entered_at:      new Date().toISOString(),
    }))

    const { error } = await supabase.from('raw_material_stock_entries').insert(inserts)
    // DB trigger auto-adds qty to raw_materials.current_stock

    if (error) {
      toast.error('Failed: ' + error.message)
    } else {
      toast.success(`${inserts.length} stock ${inserts.length > 1 ? 'entries' : 'entry'} saved — stock updated`)
      setRows([{ raw_material_id: '', quantity: '', unit_price: '', supplier: '' }])
      fetchMaterials()
    }
    setSaving(false)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Stock Received Entry</div>
          <div className="page-subtitle">Record raw material orders received — stock updates automatically</div>
        </div>
        <div className="date-wrap">
          <Calendar size={14} className="date-icon" />
          <input type="date" className="input date-input"
            value={date}
            onChange={e => setDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]} />
        </div>
      </div>

      <div className="card">
        <div className="entry-header">
          <Package size={16} color="var(--blue)" />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>Materials Received</span>
          <span className="text-faint" style={{ fontSize: 12, marginLeft: 'auto' }}>
            Stock will be added to current inventory automatically
          </span>
        </div>

        <div className="row-headers">
          <span>Material *</span>
          <span>Qty Received *</span>
          <span>Unit Price (₹)</span>
          <span>Supplier</span>
          <span></span>
        </div>

        <div className="entry-rows">
          {rows.map((row, i) => {
            const mat = materials.find(m => m.id === row.raw_material_id)
            return (
              <div key={i} className="entry-row">
                <select className="input" value={row.raw_material_id}
                  onChange={e => updateRow(i, 'raw_material_id', e.target.value)}>
                  <option value="">— Select material —</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} (stock: {parseFloat(m.current_stock).toFixed(1)} {m.unit})
                    </option>
                  ))}
                </select>

                <div className="qty-wrap">
                  <input type="number" className="input" placeholder="0"
                    min="0" step="0.01" value={row.quantity}
                    onChange={e => updateRow(i, 'quantity', e.target.value)} />
                  {mat && <span className="qty-unit">{mat.unit}</span>}
                </div>

                <div className="price-wrap">
                  <span className="price-sign">₹</span>
                  <input type="number" className="input price-input" placeholder="0.00"
                    min="0" step="0.01" value={row.unit_price}
                    onChange={e => updateRow(i, 'unit_price', e.target.value)} />
                </div>

                <div className="supplier-wrap">
                  <Truck size={13} className="supplier-icon" />
                  <input type="text" className="input supplier-input" placeholder="Supplier name…"
                    value={row.supplier}
                    onChange={e => updateRow(i, 'supplier', e.target.value)} />
                </div>

                <button className="remove-btn" onClick={() => removeRow(i)} disabled={rows.length === 1}>
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })}
        </div>

        <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={addRow}>
          <Plus size={14} /> Add Another Material
        </button>

        {/* Total cost preview */}
        {rows.some(r => r.quantity && r.unit_price) && (
          <div className="total-preview">
            <span className="text-muted">Total Purchase Cost</span>
            <span className="total-val">
              ₹{rows
                .filter(r => r.quantity && r.unit_price)
                .reduce((s, r) => s + parseFloat(r.quantity || 0) * parseFloat(r.unit_price || 0), 0)
                .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}

        <div className="entry-footer">
          <div className="audit-notice">Saved with user ID · timestamp · IP</div>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving
              ? <><Loader2 size={14} className="spin" /> Saving…</>
              : <><Save size={14} /> Save Stock Entry</>
            }
          </button>
        </div>
      </div>

      <style jsx>{`
        .date-wrap { position: relative; }
        .date-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-3); pointer-events: none; }
        .date-input { padding-left: 36px; width: 180px; }
        .entry-header { display: flex; align-items: center; gap: 10px; padding-bottom: 16px; margin-bottom: 16px; border-bottom: 1px solid var(--border); }
        .row-headers {
          display: grid; grid-template-columns: 1fr 150px 150px 1fr 32px;
          gap: 10px; font-size: 11px; font-weight: 600; color: var(--text-3);
          text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px;
        }
        .entry-rows { display: flex; flex-direction: column; gap: 10px; }
        .entry-row {
          display: grid; grid-template-columns: 1fr 150px 150px 1fr 32px;
          gap: 10px; align-items: center;
        }
        .qty-wrap { position: relative; }
        .qty-unit { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 11px; color: var(--text-3); pointer-events: none; }
        .price-wrap { position: relative; }
        .price-sign { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); font-size: 13px; color: var(--text-3); }
        .price-input { padding-left: 24px; }
        .supplier-wrap { position: relative; }
        .supplier-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--text-3); pointer-events: none; }
        .supplier-input { padding-left: 32px; }
        .remove-btn {
          width: 32px; height: 38px; border-radius: var(--r-sm);
          background: var(--surface-2); border: 1px solid var(--border);
          color: var(--text-3); cursor: pointer;
          display: flex; align-items: center; justify-content: center; transition: all 0.14s;
        }
        .remove-btn:hover:not(:disabled) { background: var(--red-dim); color: var(--red); }
        .remove-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .total-preview {
          display: flex; align-items: center; justify-content: space-between;
          background: var(--surface-2); border: 1px solid var(--border);
          border-radius: var(--r-md); padding: 12px 16px; margin-top: 16px;
        }
        .total-val { font-family: var(--font-display); font-size: 18px; font-weight: 700; color: var(--green); }
        .entry-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); }
        .audit-notice { font-size: 11px; color: var(--text-3); }
        :global(.spin) { animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          .row-headers { grid-template-columns: 1fr 130px 130px 32px; }
          .entry-row { grid-template-columns: 1fr 130px 130px 32px; }
          .supplier-wrap { display: none; }
          .row-headers > span:nth-child(4) { display: none; }
        }
      `}</style>
    </div>
  )
}