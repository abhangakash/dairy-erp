'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Plus, Pencil, Power, HandCoins, X, Loader2, Phone, Percent } from 'lucide-react'

const EMPTY_FORM = { name: '', phone: '', share_pct: '25' }

export default function PartnerMasterPage() {
  const [partners, setPartners] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm]         = useState(EMPTY_FORM)

  useEffect(() => { fetchPartners() }, [])

  async function fetchPartners() {
    setLoading(true)
    const { data } = await supabase.from('partners').select('*').order('created_at')
    setPartners(data || [])
    setLoading(false)
  }

  function openAdd() { setEditItem(null); setForm(EMPTY_FORM); setModalOpen(true) }
  function openEdit(p) {
    setEditItem(p)
    setForm({ name: p.name, phone: p.phone || '', share_pct: p.share_pct })
    setModalOpen(true)
  }
  function closeModal() { setModalOpen(false); setEditItem(null); setForm(EMPTY_FORM) }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name required'); return }
    const totalShare = partners
      .filter(p => !editItem || p.id !== editItem.id)
      .reduce((s, p) => s + parseFloat(p.share_pct || 0), 0)
    if (totalShare + parseFloat(form.share_pct || 0) > 100) {
      toast.error('Total share percentage cannot exceed 100%'); return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      name:      form.name.trim(),
      phone:     form.phone || null,
      share_pct: parseFloat(form.share_pct) || 25,
      created_by: user?.id,
    }
    if (editItem) {
      const { error } = await supabase.from('partners').update(payload).eq('id', editItem.id)
      if (error) toast.error('Failed'); else { toast.success('Updated'); fetchPartners(); closeModal() }
    } else {
      if (partners.length >= 4) { toast.error('Maximum 4 partners allowed'); setSaving(false); return }
      const { error } = await supabase.from('partners').insert(payload)
      if (error) toast.error('Failed'); else { toast.success('Partner added'); fetchPartners(); closeModal() }
    }
    setSaving(false)
  }

  async function toggleActive(p) {
    const { error } = await supabase.from('partners').update({ is_active: !p.is_active }).eq('id', p.id)
    if (error) toast.error('Failed')
    else { toast.success(p.is_active ? 'Deactivated' : 'Activated'); fetchPartners() }
  }

  const totalShare = partners.reduce((s, p) => s + parseFloat(p.share_pct || 0), 0)
  const COLORS = ['var(--brand)', 'var(--blue)', 'var(--green)', 'var(--yellow)']

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Partner Master</div>
          <div className="page-subtitle">
            {partners.length}/4 partners · Total share: {totalShare}%
          </div>
        </div>
        {partners.length < 4 && (
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={15} /> Add Partner
          </button>
        )}
      </div>

      {/* Share visual */}
      {partners.length > 0 && (
        <div className="share-bar-wrap card" style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            Ownership Distribution
          </div>
          <div className="share-bar">
            {partners.map((p, i) => (
              <div
                key={p.id}
                className="share-bar-segment"
                style={{
                  width: `${p.share_pct}%`,
                  background: COLORS[i % COLORS.length],
                  opacity: p.is_active ? 1 : 0.4,
                }}
                title={`${p.name}: ${p.share_pct}%`}
              />
            ))}
          </div>
          <div className="share-legend">
            {partners.map((p, i) => (
              <div key={p.id} className="share-legend-item">
                <div className="share-dot" style={{ background: COLORS[i % COLORS.length] }} />
                <span>{p.name}</span>
                <strong>{p.share_pct}%</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cards */}
      {loading ? (
        <div className="table-loading"><Loader2 size={20} className="spin" /> Loading…</div>
      ) : (
        <div className="partners-grid">
          {partners.map((p, i) => (
            <div key={p.id} className="partner-card" style={{ opacity: p.is_active ? 1 : 0.6 }}>
              <div className="partner-card-header">
                <div className="partner-avatar" style={{ background: COLORS[i % COLORS.length] + '22', border: `1px solid ${COLORS[i % COLORS.length]}44`, color: COLORS[i % COLORS.length] }}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="partner-name">{p.name}</div>
                  {p.phone && (
                    <div className="partner-phone"><Phone size={11} />{p.phone}</div>
                  )}
                </div>
                <span className={`badge ${p.is_active ? 'badge-green' : 'badge-red'}`} style={{ marginLeft: 'auto' }}>
                  {p.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="partner-share">
                <Percent size={14} style={{ color: COLORS[i % COLORS.length] }} />
                <span className="partner-share-val" style={{ color: COLORS[i % COLORS.length] }}>
                  {p.share_pct}%
                </span>
                <span className="text-faint">ownership share</span>
              </div>
              <div className="partner-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>
                  <Pencil size={12} /> Edit
                </button>
                <button className={`btn btn-sm ${p.is_active ? 'btn-danger' : 'btn-ghost'}`} onClick={() => toggleActive(p)}>
                  <Power size={12} /> {p.is_active ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          ))}
          {partners.length === 0 && (
            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
              <HandCoins size={32} /><p>No partners yet. Add up to 4 partners.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-header">
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>
                  {editItem ? 'Edit Partner' : 'Add Partner'}
                </div>
              </div>
              <button className="modal-close" onClick={closeModal}><X size={16} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="label">Full Name *</label>
                  <input className="input" name="name" placeholder="Partner name"
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="label"><Phone size={11} style={{display:'inline',marginRight:4}}/>Phone</label>
                    <input className="input" name="phone" placeholder="Mobile"
                      value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="label"><Percent size={11} style={{display:'inline',marginRight:4}}/>Share %</label>
                    <input className="input" type="number" name="share_pct"
                      placeholder="25" min="1" max="100" step="0.01"
                      value={form.share_pct} onChange={e => setForm(f => ({ ...f, share_pct: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><Loader2 size={14} className="spin" />Saving…</> : <><Plus size={14} />{editItem ? 'Save' : 'Add Partner'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .table-loading { display: flex; align-items: center; gap: 10px; padding: 40px 0; color: var(--text-3); }
        .partners-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
        .partner-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 20px; display: flex; flex-direction: column; gap: 14px; }
        .partner-card-header { display: flex; align-items: center; gap: 12px; }
        .partner-avatar { width: 40px; height: 40px; border-radius: var(--r-md); display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-size: 18px; font-weight: 700; flex-shrink: 0; }
        .partner-name { font-weight: 600; font-size: 15px; }
        .partner-phone { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-3); margin-top: 2px; }
        .partner-share { display: flex; align-items: center; gap: 8px; }
        .partner-share-val { font-family: var(--font-display); font-size: 22px; font-weight: 700; }
        .partner-actions { display: flex; gap: 8px; }
        .share-bar-wrap { padding: 20px; }
        .share-bar { height: 10px; border-radius: 99px; overflow: hidden; display: flex; background: var(--surface-2); margin-bottom: 14px; }
        .share-bar-segment { height: 100%; transition: width 0.3s ease; }
        .share-legend { display: flex; flex-wrap: wrap; gap: 16px; }
        .share-legend-item { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-2); }
        .share-dot { width: 8px; height: 8px; border-radius: 50%; }
        .modal-close { width: 32px; height: 32px; border-radius: var(--r-sm); background: var(--surface-2); border: 1px solid var(--border); color: var(--text-2); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        :global(.spin) { animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
