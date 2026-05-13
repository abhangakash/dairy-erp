'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  Plus, Pencil, Power, Package, Search,
  X, Loader2, AlertTriangle, FlaskConical, Save
} from 'lucide-react'

const UNITS_RM = ['kg', 'litre', 'gram', 'ml', 'pcs', 'packet', 'bag']
const EMPTY_FORM = { name: '', unit: 'kg', low_stock_alert: '', current_stock: '' }

export default function RawMaterialMasterPage() {
  const [materials, setMaterials]     = useState([])
  const [products, setProducts]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [modalOpen, setModalOpen]     = useState(false)
  const [formulaModalId, setFormulaModalId] = useState(null) // raw_material id
  const [saving, setSaving]           = useState(false)
  const [savingFormula, setSavingFormula] = useState(false)
  const [editItem, setEditItem]       = useState(null)
  const [form, setForm]               = useState(EMPTY_FORM)
  const [formula, setFormula]         = useState({}) // { product_id: qty_per_unit }

  useEffect(() => {
    fetchMaterials()
    fetchProducts()
  }, [])

  async function fetchMaterials() {
    setLoading(true)
    const { data, error } = await supabase
      .from('raw_materials')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) toast.error('Failed to load')
    else setMaterials(data || [])
    setLoading(false)
  }

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('id, name, unit')
      .eq('is_active', true)
      .order('name')
    setProducts(data || [])
  }

  function openAdd() {
    setEditItem(null); setForm(EMPTY_FORM); setModalOpen(true)
  }
  function openEdit(m) {
    setEditItem(m)
    setForm({
      name:            m.name,
      unit:            m.unit,
      low_stock_alert: m.low_stock_alert,
      current_stock:   m.current_stock,
    })
    setModalOpen(true)
  }
  function closeModal() { setModalOpen(false); setEditItem(null); setForm(EMPTY_FORM) }
  function handleChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })) }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name required'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      name:            form.name.trim(),
      unit:            form.unit,
      low_stock_alert: parseFloat(form.low_stock_alert) || 10,
      current_stock:   parseFloat(form.current_stock) || 0,
      created_by:      user?.id,
    }
    if (editItem) {
      const { error } = await supabase.from('raw_materials').update(payload).eq('id', editItem.id)
      if (error) toast.error('Failed to update')
      else { toast.success('Updated'); fetchMaterials(); closeModal() }
    } else {
      const { error } = await supabase.from('raw_materials').insert(payload)
      if (error) toast.error('Failed to add')
      else { toast.success('Added'); fetchMaterials(); closeModal() }
    }
    setSaving(false)
  }

  async function toggleActive(m) {
    const { error } = await supabase.from('raw_materials').update({ is_active: !m.is_active }).eq('id', m.id)
    if (error) toast.error('Failed')
    else { toast.success(m.is_active ? 'Deactivated' : 'Activated'); fetchMaterials() }
  }

  // ── Formula ───────────────────────────────────────────────

  async function openFormula(materialId) {
    setFormulaModalId(materialId)
    // Load existing formula for this raw material
    const { data } = await supabase
      .from('product_raw_material_formula')
      .select('*')
      .eq('raw_material_id', materialId)
    // Build map: product_id -> qty_per_unit
    const map = {}
    products.forEach(p => {
      const existing = data?.find(f => f.product_id === p.id)
      map[p.id] = existing ? existing.quantity_per_unit : ''
    })
    setFormula(map)
  }

  function closeFormula() { setFormulaModalId(null); setFormula({}) }

  async function saveFormula() {
    if (!formulaModalId) return
    setSavingFormula(true)
    const { data: { user } } = await supabase.auth.getUser()

    // Only save rows where qty > 0
    const rows = products
      .filter(p => formula[p.id] && parseFloat(formula[p.id]) > 0)
      .map(p => ({
        raw_material_id:  formulaModalId,
        product_id:       p.id,
        quantity_per_unit: parseFloat(formula[p.id]),
        created_by:       user?.id,
      }))

    // Delete then re-insert for this material
    await supabase
      .from('product_raw_material_formula')
      .delete()
      .eq('raw_material_id', formulaModalId)

    if (rows.length > 0) {
      const { error } = await supabase
        .from('product_raw_material_formula')
        .insert(rows)
      if (error) { toast.error('Failed to save formula'); setSavingFormula(false); return }
    }

    toast.success('Formula saved')
    closeFormula()
    setSavingFormula(false)
  }

  const filtered = materials.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase())
  )

  const formulaMaterial = materials.find(m => m.id === formulaModalId)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Raw Material Master</div>
          <div className="page-subtitle">
            {materials.filter(m => m.current_stock <= m.low_stock_alert).length} items low on stock
          </div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={15} /> Add Material
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16, maxWidth: 300 }}>
        <div className="search-wrap">
          <Search size={14} className="search-icon" />
          <input className="input search-input" placeholder="Search materials…"
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="search-clear" onClick={() => setSearch('')}><X size={13} /></button>}
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Material</th>
              <th>Unit</th>
              <th>Current Stock</th>
              <th>Low Stock Alert</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}>
                <div className="table-loading"><Loader2 size={20} className="spin" /> Loading…</div>
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7}>
                <div className="empty-state"><Package size={32} /><p>No raw materials yet</p></div>
              </td></tr>
            ) : (
              filtered.map((m, i) => {
                const isLow = m.current_stock <= m.low_stock_alert
                return (
                  <tr key={m.id} style={{ opacity: m.is_active ? 1 : 0.55 }}>
                    <td className="text-faint">{i + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {isLow && <AlertTriangle size={14} color="var(--yellow)" />}
                        <span style={{ fontWeight: 500 }}>{m.name}</span>
                      </div>
                    </td>
                    <td><span className="badge badge-orange">{m.unit}</span></td>
                    <td>
                      <span style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 600,
                        color: isLow ? 'var(--red)' : 'var(--green)',
                        fontSize: 15,
                      }}>
                        {parseFloat(m.current_stock).toLocaleString('en-IN')}
                        <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-body)', fontWeight: 400 }}>
                          {' '}{m.unit}
                        </span>
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>
                      {m.low_stock_alert} {m.unit}
                    </td>
                    <td>
                      {isLow
                        ? <span className="badge badge-red"><AlertTriangle size={10} /> Low Stock</span>
                        : <span className="badge badge-green">OK</span>
                      }
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(m)}>
                          <Pencil size={12} /> Edit
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => openFormula(m.id)}>
                          <FlaskConical size={12} /> Formula
                        </button>
                        <button
                          className={`btn btn-sm ${m.is_active ? 'btn-danger' : 'btn-ghost'}`}
                          onClick={() => toggleActive(m)}>
                          <Power size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-header">
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>
                  {editItem ? 'Edit Raw Material' : 'Add Raw Material'}
                </div>
              </div>
              <button className="modal-close" onClick={closeModal}><X size={16} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="label">Material Name *</label>
                  <input className="input" name="name" placeholder="e.g. Milk, Sugar, Curd"
                    value={form.name} onChange={handleChange} required autoFocus />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="label">Unit *</label>
                    <select className="input" name="unit" value={form.unit} onChange={handleChange}>
                      {UNITS_RM.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="label">Low Stock Alert Threshold</label>
                    <input className="input" type="number" name="low_stock_alert"
                      placeholder="10" min="0" step="0.1"
                      value={form.low_stock_alert} onChange={handleChange} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="label">Opening Stock (current qty)</label>
                  <input className="input" type="number" name="current_stock"
                    placeholder="0" min="0" step="0.01"
                    value={form.current_stock} onChange={handleChange} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><Loader2 size={14} className="spin" /> Saving…</> : <><Plus size={14} /> {editItem ? 'Save' : 'Add'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Formula Modal */}
      {formulaModalId && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && closeFormula()}>
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>
                  Usage Formula
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                  How much <strong>{formulaMaterial?.name}</strong> ({formulaMaterial?.unit}) is used per unit of each product?
                </div>
              </div>
              <button className="modal-close" onClick={closeFormula}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {products.length === 0 ? (
                <div className="empty-state"><p>No active products. Add products first.</p></div>
              ) : (
                <div className="formula-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Product Unit</th>
                        <th>{formulaMaterial?.name} per product unit ({formulaMaterial?.unit})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map(p => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 500 }}>{p.name}</td>
                          <td><span className="badge badge-blue">{p.unit}</span></td>
                          <td>
                            <input
                              className="input"
                              type="number"
                              min="0"
                              step="0.0001"
                              placeholder="0 = not used"
                              style={{ padding: '7px 10px', fontSize: 13 }}
                              value={formula[p.id] ?? ''}
                              onChange={e => setFormula(prev => ({ ...prev, [p.id]: e.target.value }))}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="formula-hint">
                Example: If 1 litre of Lassi uses 0.9 litre of Milk, enter 0.9 for Lassi.
                Leave 0 or blank if this material is not used for that product.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closeFormula}>Cancel</button>
              <button className="btn btn-primary" onClick={saveFormula} disabled={savingFormula}>
                {savingFormula
                  ? <><Loader2 size={14} className="spin" /> Saving…</>
                  : <><Save size={14} /> Save Formula</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .search-wrap { position: relative; }
        .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-3); pointer-events: none; }
        .search-input { padding-left: 36px; padding-right: 32px; }
        .search-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-3); cursor: pointer; display: flex; }
        .table-loading { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 40px; color: var(--text-3); }
        .modal-close { width: 32px; height: 32px; border-radius: var(--r-sm); background: var(--surface-2); border: 1px solid var(--border); color: var(--text-2); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .formula-table-wrap { border: 1px solid var(--border); border-radius: var(--r-md); overflow: hidden; }
        .formula-hint { margin-top: 12px; font-size: 12px; color: var(--text-3); background: var(--surface-2); border-radius: var(--r-sm); padding: 10px 14px; }
        :global(.spin) { animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
  }
