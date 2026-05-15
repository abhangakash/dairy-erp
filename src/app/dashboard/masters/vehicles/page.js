'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Plus, Pencil, Power, Truck, X, Loader2, Fuel, IndianRupee } from 'lucide-react'

const FUEL_TYPES = ['fuel', 'cng', 'both']
const EMPTY_FORM = { name: '', fuel_type: 'fuel', rate_per_km: '' }

export default function VehicleMasterPage() {
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm]         = useState(EMPTY_FORM)

  useEffect(() => { fetchVehicles() }, [])

  async function fetchVehicles() {
    setLoading(true)
    const { data } = await supabase.from('vehicles').select('*').order('created_at', { ascending: false })
    setVehicles(data || [])
    setLoading(false)
  }

  function openAdd() { setEditItem(null); setForm(EMPTY_FORM); setModalOpen(true) }
  function openEdit(v) {
    setEditItem(v)
    setForm({ name: v.name, fuel_type: v.fuel_type, rate_per_km: v.rate_per_km || '' })
    setModalOpen(true)
  }
  function closeModal() { setModalOpen(false); setEditItem(null); setForm(EMPTY_FORM) }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name required'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      name:        form.name.trim(),
      fuel_type:   form.fuel_type,
      rate_per_km: parseFloat(form.rate_per_km) || 0,
      created_by:  user?.id,
    }
    if (editItem) {
      const { error } = await supabase.from('vehicles').update(payload).eq('id', editItem.id)
      if (error) toast.error('Failed'); else { toast.success('Updated'); fetchVehicles(); closeModal() }
    } else {
      const { error } = await supabase.from('vehicles').insert(payload)
      if (error) toast.error('Failed'); else { toast.success('Vehicle added'); fetchVehicles(); closeModal() }
    }
    setSaving(false)
  }

  async function toggleActive(v) {
    const { error } = await supabase.from('vehicles').update({ is_active: !v.is_active }).eq('id', v.id)
    if (error) toast.error('Failed')
    else { toast.success(v.is_active ? 'Deactivated' : 'Activated'); fetchVehicles() }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Vehicle Master</div>
          <div className="page-subtitle">{vehicles.filter(v => v.is_active).length} active vehicles</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={15} /> Add Vehicle
        </button>
      </div>

      <div className="vehicles-grid">
        {loading ? (
          <div className="table-loading"><Loader2 size={20} className="spin" /> Loading…</div>
        ) : vehicles.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>
            <Truck size={32} /><p>No vehicles yet</p>
          </div>
        ) : (
          vehicles.map(v => (
            <div key={v.id} className="vehicle-card" style={{ opacity: v.is_active ? 1 : 0.6 }}>
              <div className="vehicle-header">
                <div className="vehicle-icon">
                  <Truck size={20} color="var(--brand)" strokeWidth={1.8} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="vehicle-name">{v.name}</div>
                  <span className={`badge badge-${v.fuel_type === 'cng' ? 'green' : v.fuel_type === 'both' ? 'yellow' : 'blue'}`}>
                    {v.fuel_type.toUpperCase()}
                  </span>
                </div>
                <span className={`badge ${v.is_active ? 'badge-green' : 'badge-red'}`}>
                  {v.is_active ? 'Active' : 'Off'}
                </span>
              </div>
              <div className="vehicle-stat">
                <IndianRupee size={13} color="var(--text-3)" />
                <span className="vehicle-rate">
                  ₹{parseFloat(v.rate_per_km || 0).toFixed(2)}
                </span>
                <span className="text-faint">per km</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(v)}>
                  <Pencil size={12} /> Edit
                </button>
                <button className={`btn btn-sm ${v.is_active ? 'btn-danger' : 'btn-ghost'}`} onClick={() => toggleActive(v)}>
                  <Power size={12} /> {v.is_active ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {modalOpen && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-header">
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>
                  {editItem ? 'Edit Vehicle' : 'Add Vehicle'}
                </div>
              </div>
              <button className="modal-close" onClick={closeModal}><X size={16} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="label">Vehicle Name / Number *</label>
                  <input className="input" name="name" placeholder="e.g. Tata Ace MH-12-AB-1234"
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
                </div>
                <div className="form-group">
                  <label className="label">Fuel Type</label>
                  <div className="fuel-type-toggle">
                    {FUEL_TYPES.map(ft => (
                      <button key={ft} type="button"
                        className={`fuel-btn ${form.fuel_type === ft ? 'fuel-btn-active' : ''}`}
                        onClick={() => setForm(f => ({ ...f, fuel_type: ft }))}>
                        {ft.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="label">
                    <IndianRupee size={11} style={{display:'inline',marginRight:4}}/>Rate per km (₹)
                  </label>
                  <input className="input" type="number" name="rate_per_km"
                    placeholder="e.g. 8.5" min="0" step="0.01"
                    value={form.rate_per_km} onChange={e => setForm(f => ({ ...f, rate_per_km: e.target.value }))} />
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5 }}>
                    Used to auto-calculate expense when distance is entered against a distributor route.
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><Loader2 size={14} className="spin" />Saving…</> : <><Plus size={14} />{editItem ? 'Save' : 'Add Vehicle'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .vehicles-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
        .vehicle-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 20px; display: flex; flex-direction: column; gap: 14px; }
        .vehicle-header { display: flex; align-items: flex-start; gap: 12px; }
        .vehicle-icon { width: 44px; height: 44px; border-radius: var(--r-md); background: var(--brand-glow); border: 1px solid rgba(249,115,22,0.2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .vehicle-name { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
        .vehicle-stat { display: flex; align-items: center; gap: 6px; }
        .vehicle-rate { font-family: var(--font-display); font-size: 20px; font-weight: 700; color: var(--green); }
        .table-loading { display: flex; align-items: center; gap: 10px; padding: 40px 0; color: var(--text-3); }
        .fuel-type-toggle { display: flex; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r-md); padding: 3px; gap: 3px; }
        .fuel-btn { flex: 1; padding: 8px; border: none; border-radius: var(--r-sm); background: none; color: var(--text-2); font-family: var(--font-body); font-size: 13px; cursor: pointer; transition: all 0.14s; font-weight: 500; }
        .fuel-btn-active { background: var(--brand); color: #fff; }
        .modal-close { width: 32px; height: 32px; border-radius: var(--r-sm); background: var(--surface-2); border: 1px solid var(--border); color: var(--text-2); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        :global(.spin) { animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) {

  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
  }

  .page-header .btn {
    width: 100%;
    justify-content: center;
  }

  .vehicles-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 640px) {

  .vehicles-grid {
    grid-template-columns: 1fr;
  }

  .vehicle-card {
    padding: 16px;
  }

  .vehicle-header {
    align-items: flex-start;
  }

  .vehicle-name {
    font-size: 14px;
    line-height: 1.5;
  }

  .vehicle-rate {
    font-size: 18px;
  }

  .modal {
    width: calc(100vw - 24px);
    max-height: 90vh;
    overflow-y: auto;
  }

  .fuel-type-toggle {
    flex-direction: column;
  }

  .fuel-btn {
    width: 100%;
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

  .vehicle-icon {
    width: 40px;
    height: 40px;
  }
}
      `}</style>
    </div>
  )
  }
