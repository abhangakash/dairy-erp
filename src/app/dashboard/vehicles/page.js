
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  Truck, Plus, Trash2, Save, Loader2,
  Calendar, MapPin, IndianRupee, X
} from 'lucide-react'

const EXPENSE_TYPES = ['fuel', 'cng', 'toll', 'bhatta', 'maintenance', 'other']

export default function VehicleExpensesPage() {
  const [vehicles, setVehicles]         = useState([])
  const [distributors, setDistributors] = useState([])
  const [saving, setSaving]             = useState(false)
  const [date, setDate]                 = useState(new Date().toISOString().split('T')[0])
  const [rows, setRows]                 = useState([{
    vehicle_id: '', distributor_id: '', expense_type: 'fuel',
    distance_km: '', rate_per_km: '', manual_amount: '', notes: ''
  }])
  const [todayEntries, setTodayEntries] = useState([])

  useEffect(() => {
    fetchVehicles()
    fetchDistributors()
    fetchTodayEntries(date)
  }, [])

  async function fetchVehicles() {
    const { data } = await supabase
      .from('vehicles').select('id, name, fuel_type, rate_per_km').eq('is_active', true).order('name')
    setVehicles(data || [])
  }

  async function fetchDistributors() {
    const { data } = await supabase
      .from('distributors').select('id, name, distance_km, route').eq('is_active', true).order('name')
    setDistributors(data || [])
  }

  async function fetchTodayEntries(forDate) {
    const { data } = await supabase
      .from('vehicle_expenses')
      .select('id, expense_type, distance_km, rate_per_km, auto_amount, manual_amount, total_amount, notes, entered_at, vehicles(name), distributors(name)')
      .eq('entry_date', forDate)
      .order('entered_at', { ascending: false })
    setTodayEntries(data || [])
  }

  function updateRow(i, field, value) {
    setRows(prev => prev.map((row, idx) => {
      if (idx !== i) return row
      const updated = { ...row, [field]: value }

      // Auto-fill distance + rate when distributor selected
      if (field === 'distributor_id' && value) {
        const dist = distributors.find(d => d.id === value)
        if (dist?.distance_km) updated.distance_km = dist.distance_km
      }
      // Auto-fill rate when vehicle selected
      if (field === 'vehicle_id' && value) {
        const veh = vehicles.find(v => v.id === value)
        if (veh?.rate_per_km) updated.rate_per_km = veh.rate_per_km
      }
      return updated
    }))
  }

  function getAutoAmount(row) {
    const dist = parseFloat(row.distance_km) || 0
    const rate = parseFloat(row.rate_per_km) || 0
    return dist * rate
  }

  function getTotal(row) {
    return getAutoAmount(row) + (parseFloat(row.manual_amount) || 0)
  }

  async function handleSave() {
    const valid = rows.filter(r => r.vehicle_id && r.expense_type && getTotal(r) > 0)
    if (valid.length === 0) { toast.error('Add at least one entry with vehicle and amount'); return }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    const inserts = valid.map(r => {
      const auto   = getAutoAmount(r)
      const manual = parseFloat(r.manual_amount) || 0
      return {
        vehicle_id:      r.vehicle_id,
        distributor_id:  r.distributor_id || null,
        entry_date:      date,
        expense_type:    r.expense_type,
        distance_km:     r.distance_km ? parseFloat(r.distance_km) : null,
        rate_per_km:     r.rate_per_km  ? parseFloat(r.rate_per_km) : null,
        auto_amount:     auto   > 0 ? auto   : null,
        manual_amount:   manual > 0 ? manual : null,
        total_amount:    auto + manual,
        notes:           r.notes || null,
        entered_by:      user?.id,
        entered_at:      new Date().toISOString(),
      }
    })

    const { error } = await supabase.from('vehicle_expenses').insert(inserts)
    if (error) toast.error('Failed: ' + error.message)
    else {
      toast.success(`${inserts.length} vehicle expense${inserts.length > 1 ? 's' : ''} saved`)
      setRows([{ vehicle_id: '', distributor_id: '', expense_type: 'fuel', distance_km: '', rate_per_km: '', manual_amount: '', notes: '' }])
      fetchTodayEntries(date)
    }
    setSaving(false)
  }

  async function deleteEntry(id) {
    if (!confirm('Delete this entry?')) return
    const { error } = await supabase.from('vehicle_expenses').delete().eq('id', id)
    if (error) toast.error('Failed')
    else { toast.success('Deleted'); fetchTodayEntries(date) }
  }

  const todayTotal = todayEntries.reduce((s, e) => s + parseFloat(e.total_amount || 0), 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Vehicle Expenses</div>
          <div className="page-subtitle">Track CNG, fuel, toll and route costs</div>
        </div>
        <div className="date-wrap">
          <Calendar size={14} className="date-icon" />
          <input type="date" className="input date-input"
            value={date}
            onChange={e => { setDate(e.target.value); fetchTodayEntries(e.target.value) }}
            max={new Date().toISOString().split('T')[0]} />
        </div>
      </div>

      <div className="vehicle-layout">
        {/* Entry form */}
        <div className="card">
          <div className="entry-header">
            <Truck size={16} color="var(--brand)" />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>Add Vehicle Expense</span>
          </div>

          <div className="entry-rows">
            {rows.map((row, i) => {
              const autoAmt = getAutoAmount(row)
              const total   = getTotal(row)
              return (
                <div key={i} className="entry-row-card">
                  <div className="row-grid-top">
                    {/* Vehicle */}
                    <div className="form-group">
                      <label className="label">Vehicle *</label>
                      <select className="input" value={row.vehicle_id}
                        onChange={e => updateRow(i, 'vehicle_id', e.target.value)}>
                        <option value="">— Select vehicle —</option>
                        {vehicles.map(v => (
                          <option key={v.id} value={v.id}>{v.name} ({v.fuel_type.toUpperCase()})</option>
                        ))}
                      </select>
                    </div>

                    {/* Expense type */}
                    <div className="form-group">
                      <label className="label">Type *</label>
                      <select className="input" value={row.expense_type}
                        onChange={e => updateRow(i, 'expense_type', e.target.value)}>
                        {EXPENSE_TYPES.map(t => (
                          <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                        ))}
                      </select>
                    </div>

                    {/* Distributor (optional) */}
                    <div className="form-group">
                      <label className="label">Distributor Route (optional)</label>
                      <select className="input" value={row.distributor_id}
                        onChange={e => updateRow(i, 'distributor_id', e.target.value)}>
                        <option value="">— Select for auto distance —</option>
                        {distributors.map(d => (
                          <option key={d.id} value={d.id}>
                            {d.name}{d.distance_km > 0 ? ` (${d.distance_km} km)` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="row-grid-bottom">
                    {/* Distance */}
                    <div className="form-group">
                      <label className="label"><MapPin size={11} style={{display:'inline',marginRight:4}}/>Distance (km)</label>
                      <input className="input" type="number" placeholder="0" min="0" step="0.1"
                        value={row.distance_km}
                        onChange={e => updateRow(i, 'distance_km', e.target.value)} />
                    </div>

                    {/* Rate per km */}
                    <div className="form-group">
                      <label className="label">Rate/km (₹)</label>
                      <input className="input" type="number" placeholder="0.00" min="0" step="0.01"
                        value={row.rate_per_km}
                        onChange={e => updateRow(i, 'rate_per_km', e.target.value)} />
                    </div>

                    {/* Auto amount */}
                    <div className="form-group">
                      <label className="label">Auto Amount (₹)</label>
                      <div className="auto-amount-box">
                        {autoAmt > 0 ? `₹${autoAmt.toFixed(2)}` : <span className="text-faint">—</span>}
                        {autoAmt > 0 && <span className="auto-hint">dist × rate</span>}
                      </div>
                    </div>

                    {/* Manual amount */}
                    <div className="form-group">
                      <label className="label">Manual Amount (₹)</label>
                      <div className="price-wrap">
                        <span className="price-sign">₹</span>
                        <input className="input price-input" type="number" placeholder="0.00" min="0" step="0.01"
                          value={row.manual_amount}
                          onChange={e => updateRow(i, 'manual_amount', e.target.value)} />
                      </div>
                    </div>

                    {/* Total */}
                    <div className="form-group">
                      <label className="label">Total</label>
                      <div className="total-box">
                        {total > 0
                          ? <span className="total-val">₹{total.toFixed(2)}</span>
                          : <span className="text-faint">—</span>
                        }
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="form-group">
                      <label className="label">Notes</label>
                      <input className="input" placeholder="Optional…"
                        value={row.notes}
                        onChange={e => updateRow(i, 'notes', e.target.value)} />
                    </div>
                  </div>

                  {rows.length > 1 && (
                    <button className="remove-row-btn" onClick={() => setRows(r => r.filter((_, idx) => idx !== i))}>
                      <X size={13} /> Remove
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setRows(r => [...r, { vehicle_id: '', distributor_id: '', expense_type: 'fuel', distance_km: '', rate_per_km: '', manual_amount: '', notes: '' }])}>
            <Plus size={14} /> Add Another Entry
          </button>

          <div className="entry-footer">
            <div className="audit-notice">Saved with user ID · timestamp · IP</div>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 size={14} className="spin" /> Saving…</> : <><Save size={14} /> Save Expenses</>}
            </button>
          </div>
        </div>

        {/* Today summary */}
        <div className="card today-card">
          <div className="today-header">
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>Today's Expenses</div>
            <div className="today-total">₹{todayTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          {todayEntries.length === 0 ? (
            <div className="empty-state" style={{ padding: '28px 0' }}>
              <Truck size={28} /><p>No entries for this date</p>
            </div>
          ) : (
            <div className="today-list">
              {todayEntries.map(e => (
                <div key={e.id} className="today-row">
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{e.vehicles?.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {e.expense_type.toUpperCase()}
                      {e.distributors?.name ? ` · ${e.distributors.name}` : ''}
                      {e.distance_km ? ` · ${e.distance_km} km` : ''}
                    </div>
                  </div>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--brand)' }}>
                    ₹{parseFloat(e.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <button className="delete-btn" onClick={() => deleteEntry(e.id)}><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }
        .vehicle-layout { display: grid; grid-template-columns: 1fr 300px; gap: 20px; align-items: start; }
        .date-wrap { position: relative; }
        .date-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-3); pointer-events: none; }
        .date-input { padding-left: 36px; width: 180px; }
        .entry-header { display: flex; align-items: center; gap: 10px; padding-bottom: 16px; margin-bottom: 16px; border-bottom: 1px solid var(--border); }
        .entry-rows { display: flex; flex-direction: column; gap: 16px; }
        .entry-row-card { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r-md); padding: 16px; }
        .row-grid-top { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 12px; }
        .row-grid-bottom { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr; gap: 12px; }
        .auto-amount-box { height: 38px; background: var(--surface-3); border: 1px solid var(--border); border-radius: var(--r-md); padding: 0 14px; display: flex; align-items: center; justify-content: space-between; font-weight: 600; color: var(--blue); }
        .auto-hint { font-size: 10px; color: var(--text-3); font-weight: 400; }
        .price-wrap { position: relative; }
        .price-sign { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); font-size: 13px; color: var(--text-3); }
        .price-input { padding-left: 24px; }
        .total-box { height: 38px; background: var(--brand-glow); border: 1px solid rgba(249,115,22,0.25); border-radius: var(--r-md); padding: 0 14px; display: flex; align-items: center; }
        .total-val { font-family: var(--font-display); font-weight: 700; color: var(--brand); font-size: 15px; }
        .remove-row-btn { display: flex; align-items: center; gap: 6px; margin-top: 12px; padding: 6px 12px; border-radius: var(--r-sm); background: var(--red-dim); border: 1px solid rgba(248,113,113,0.25); color: var(--red); font-size: 12px; cursor: pointer; font-family: var(--font-body); }
        .entry-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); }
        .audit-notice { font-size: 11px; color: var(--text-3); }
        .today-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
        .today-total { font-family: var(--font-display); font-size: 18px; font-weight: 700; color: var(--brand); }
        .today-list { display: flex; flex-direction: column; gap: 8px; }
        .today-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r-sm); }
        .today-row > div { flex: 1; }
        .delete-btn { width: 24px; height: 24px; border-radius: var(--r-sm); background: none; border: none; color: var(--text-3); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.12s; }
        .delete-btn:hover { background: var(--red-dim); color: var(--red); }
        :global(.spin) { animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 960px) {
  .vehicle-layout {
    grid-template-columns: 1fr;
  }

  .row-grid-top {
    grid-template-columns: 1fr 1fr;
  }

  .row-grid-bottom {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 640px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .date-input {
    width: 100%;
  }

  .row-grid-top,
  .row-grid-bottom {
    grid-template-columns: 1fr;
  }

  .entry-footer {
    flex-direction: column;
    gap: 12px;
  }

  .entry-footer .btn {
    width: 100%;
  }

  .today-row {
    flex-wrap: wrap;
  }

  .today-row > div {
    width: 100%;
  }
}
      `}</style>
    </div>
  )
}