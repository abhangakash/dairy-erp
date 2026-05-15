'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  Plus, Pencil, Power, Users, Search,
  X, Loader2, Phone, Calendar, IndianRupee
} from 'lucide-react'

const ROLES = ['Plant Worker', 'Driver', 'Cleaner', 'Supervisor', 'Helper', 'Other']
const EMPTY_FORM = {
  name: '', phone: '', role: '', salary_type: 'daily_wage',
  salary_amount: '', join_date: ''
}

export default function WorkerMasterPage() {
  const [workers, setWorkers]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [filterType, setFilterType] = useState('all')

  useEffect(() => { fetchWorkers() }, [])

  async function fetchWorkers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) toast.error('Failed to load workers')
    else setWorkers(data || [])
    setLoading(false)
  }

  function openAdd() {
    setEditItem(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(w) {
    setEditItem(w)
    setForm({
      name:          w.name,
      phone:         w.phone || '',
      role:          w.role || '',
      salary_type:   w.salary_type,
      salary_amount: w.salary_amount,
      join_date:     w.join_date || '',
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditItem(null)
    setForm(EMPTY_FORM)
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Worker name required'); return }
    if (!form.salary_amount || isNaN(form.salary_amount)) {
      toast.error('Enter a valid salary amount'); return
    }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    const payload = {
      name:          form.name.trim(),
      phone:         form.phone || null,
      role:          form.role || null,
      salary_type:   form.salary_type,
      salary_amount: parseFloat(form.salary_amount),
      join_date:     form.join_date || null,
      created_by:    user?.id,
    }

    if (editItem) {
      const { error } = await supabase.from('workers').update(payload).eq('id', editItem.id)
      if (error) toast.error('Failed to update')
      else { toast.success('Worker updated'); fetchWorkers(); closeModal() }
    } else {
      const { error } = await supabase.from('workers').insert(payload)
      if (error) toast.error('Failed to add')
      else { toast.success('Worker added'); fetchWorkers(); closeModal() }
    }
    setSaving(false)
  }

  async function toggleActive(w) {
    const { error } = await supabase
      .from('workers').update({ is_active: !w.is_active }).eq('id', w.id)
    if (error) toast.error('Failed to update')
    else { toast.success(w.is_active ? 'Deactivated' : 'Activated'); fetchWorkers() }
  }

  const filtered = workers.filter(w => {
    const matchSearch =
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      (w.role || '').toLowerCase().includes(search.toLowerCase())
    const matchType =
      filterType === 'all'        ? true :
      filterType === 'active'     ? w.is_active :
      filterType === 'fixed'      ? w.salary_type === 'fixed' :
      filterType === 'daily_wage' ? w.salary_type === 'daily_wage' :
      !w.is_active
    return matchSearch && matchType
  })

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Worker Master</div>
          <div className="page-subtitle">
            {workers.filter(w => w.is_active).length} active workers ·{' '}
            {workers.filter(w => w.salary_type === 'fixed').length} fixed,{' '}
            {workers.filter(w => w.salary_type === 'daily_wage').length} daily wage
          </div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={15} /> Add Worker
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-wrap">
          <Search size={14} className="search-icon" />
          <input className="input search-input" placeholder="Search workers…"
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="search-clear" onClick={() => setSearch('')}><X size={13} /></button>}
        </div>
        <div className="filter-tabs">
          {[
            { key: 'all',        label: 'All' },
            { key: 'active',     label: 'Active' },
            { key: 'fixed',      label: 'Fixed Salary' },
            { key: 'daily_wage', label: 'Daily Wage' },
          ].map(f => (
            <button key={f.key}
              className={`filter-tab ${filterType === f.key ? 'filter-tab-active' : ''}`}
              onClick={() => setFilterType(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Role</th>
              <th>Phone</th>
              <th>Salary Type</th>
              <th>Amount</th>
              <th>Join Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9}>
                <div className="table-loading"><Loader2 size={20} className="spin" /> Loading…</div>
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9}>
                <div className="empty-state"><Users size={32} />
                  <p>{search ? 'No match' : 'No workers yet'}</p>
                </div>
              </td></tr>
            ) : (
              filtered.map((w, i) => (
                <tr key={w.id} style={{ opacity: w.is_active ? 1 : 0.55 }}>
                  <td className="text-faint">{i + 1}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="worker-avatar">
                        {w.name.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 500 }}>{w.name}</span>
                    </div>
                  </td>
                  <td>
                    {w.role
                      ? <span className="badge badge-blue">{w.role}</span>
                      : <span className="text-faint">—</span>
                    }
                  </td>
                  <td>
                    {w.phone
                      ? <span style={{ color: 'var(--text-2)', fontSize: 13 }}>{w.phone}</span>
                      : <span className="text-faint">—</span>
                    }
                  </td>
                  <td>
                    <span className={`badge ${w.salary_type === 'fixed' ? 'badge-yellow' : 'badge-orange'}`}>
                      {w.salary_type === 'fixed' ? 'Fixed' : 'Daily Wage'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--green)' }}>
                      ₹{parseFloat(w.salary_amount).toLocaleString('en-IN')}
                      <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-body)', fontWeight: 400 }}>
                        {w.salary_type === 'fixed' ? '/mo' : '/day'}
                      </span>
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-2)', fontSize: 13 }}>
                    {w.join_date
                      ? new Date(w.join_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                      : <span className="text-faint">—</span>
                    }
                  </td>
                  <td>
                    <span className={`badge ${w.is_active ? 'badge-green' : 'badge-red'}`}>
                      {w.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(w)}>
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        className={`btn btn-sm ${w.is_active ? 'btn-danger' : 'btn-ghost'}`}
                        onClick={() => toggleActive(w)}>
                        <Power size={12} />
                        {w.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-header">
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>
                  {editItem ? 'Edit Worker' : 'Add Worker'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                  {editItem ? editItem.name : 'Enter worker details'}
                </div>
              </div>
              <button className="modal-close" onClick={closeModal}><X size={16} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="label">Full Name *</label>
                  <input className="input" name="name" placeholder="Worker name"
                    value={form.name} onChange={handleChange} required autoFocus />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="label"><Phone size={11} style={{display:'inline',marginRight:4}}/>Phone</label>
                    <input className="input" name="phone" placeholder="Mobile number"
                      value={form.phone} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label className="label">Role</label>
                    <select className="input" name="role" value={form.role} onChange={handleChange}>
                      <option value="">— Select —</option>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>

                {/* Salary type toggle */}
                <div className="form-group">
                  <label className="label">Salary Type *</label>
                  <div className="salary-type-toggle">
                    {[
                      { val: 'daily_wage', label: 'Daily Wage' },
                      { val: 'fixed',      label: 'Fixed Monthly' },
                    ].map(opt => (
                      <button
                        key={opt.val}
                        type="button"
                        className={`salary-type-btn ${form.salary_type === opt.val ? 'salary-type-active' : ''}`}
                        onClick={() => setForm(f => ({ ...f, salary_type: opt.val }))}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="label">
                      <IndianRupee size={11} style={{display:'inline',marginRight:4}} />
                      {form.salary_type === 'fixed' ? 'Monthly Salary (₹)' : 'Per Day Wage (₹)'} *
                    </label>
                    <input className="input" type="number" name="salary_amount"
                      placeholder="Amount" min="0" step="1"
                      value={form.salary_amount} onChange={handleChange} required />
                  </div>
                  <div className="form-group">
                    <label className="label">
                      <Calendar size={11} style={{display:'inline',marginRight:4}} />
                      Join Date
                    </label>
                    <input className="input" type="date" name="join_date"
                      value={form.join_date} onChange={handleChange} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving
                    ? <><Loader2 size={14} className="spin" /> Saving…</>
                    : <><Plus size={14} /> {editItem ? 'Save Changes' : 'Add Worker'}</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .filters-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
        .search-wrap { position: relative; min-width: 200px; max-width: 280px; }
        .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-3); pointer-events: none; }
        .search-input { padding-left: 36px; padding-right: 32px; }
        .search-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-3); cursor: pointer; display: flex; }
        .filter-tabs { display: flex; gap: 4px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r-md); padding: 3px; }
        .filter-tab { padding: 6px 14px; border-radius: var(--r-sm); font-size: 13px; color: var(--text-2); background: none; border: none; cursor: pointer; transition: all 0.14s; }
        .filter-tab:hover { color: var(--text); }
        .filter-tab-active { background: var(--surface-3); color: var(--text); font-weight: 500; }
        .worker-avatar { width: 28px; height: 28px; border-radius: var(--r-sm); background: var(--brand-glow); border: 1px solid rgba(249,115,22,0.2); color: var(--brand); font-family: var(--font-display); font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .salary-type-toggle { display: flex; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r-md); padding: 3px; gap: 3px; }
        .salary-type-btn { flex: 1; padding: 8px; border: none; border-radius: var(--r-sm); background: none; color: var(--text-2); font-family: var(--font-body); font-size: 13px; cursor: pointer; transition: all 0.14s; }
        .salary-type-active { background: var(--brand); color: #fff; font-weight: 500; }
        .table-loading { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 40px; color: var(--text-3); }
        .modal-close { width: 32px; height: 32px; border-radius: var(--r-sm); background: var(--surface-2); border: 1px solid var(--border); color: var(--text-2); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        :global(.spin) { animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) {

  .filters-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-wrap {
    width: 100%;
    max-width: 100%;
  }

  .filter-tabs {
    width: 100%;
    overflow-x: auto;
    padding-bottom: 4px;
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

  .table-wrap {
    overflow-x: auto;
  }

  table {
    min-width: 1100px;
  }

  .grid-2 {
    grid-template-columns: 1fr;
  }

  .modal {
    width: calc(100vw - 24px);
    max-height: 90vh;
    overflow-y: auto;
  }

  .salary-type-toggle {
    flex-direction: column;
  }

  .salary-type-btn {
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

  .worker-avatar {
    width: 30px;
    height: 30px;
  }

  .search-input {
    font-size: 14px;
  }
}
      `}</style>
    </div>
  )
      }
