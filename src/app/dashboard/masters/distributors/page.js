'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  Plus, Pencil, Power, Truck, Search, X,
  Loader2, Phone, MapPin, ChevronDown,
  ChevronRight, IndianRupee, Save
} from 'lucide-react'

const EMPTY_FORM = { name: '', phone: '', address: '', route: '', distance_km: '' }

export default function DistributorMasterPage() {
  const [distributors, setDistributors] = useState([])
  const [products, setProducts]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [modalOpen, setModalOpen]       = useState(false)
  const [priceModalId, setPriceModalId] = useState(null) // distributor id for price modal
  const [saving, setSaving]             = useState(false)
  const [savingPrices, setSavingPrices] = useState(false)
  const [editItem, setEditItem]         = useState(null)
  const [form, setForm]                 = useState(EMPTY_FORM)
  const [prices, setPrices]             = useState({}) // { product_id: price }
  const [existingPrices, setExistingPrices] = useState([])

  useEffect(() => {
    fetchDistributors()
    fetchProducts()
  }, [])

  async function fetchDistributors() {
    setLoading(true)
    const { data, error } = await supabase
      .from('distributors')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) toast.error('Failed to load distributors')
    else setDistributors(data || [])
    setLoading(false)
  }

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('id, name, unit, sale_price')
      .eq('is_active', true)
      .order('name')
    setProducts(data || [])
  }

  // ── Distributor CRUD ──────────────────────────────────────

  function openAdd() {
    setEditItem(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(d) {
    setEditItem(d)
    setForm({
      name:        d.name,
      phone:       d.phone || '',
      address:     d.address || '',
      route:       d.route || '',
      distance_km: d.distance_km || '',
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
    if (!form.name.trim()) { toast.error('Distributor name is required'); return }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    const payload = {
      name:        form.name.trim(),
      phone:       form.phone || null,
      address:     form.address || null,
      route:       form.route || null,
      distance_km: form.distance_km ? parseFloat(form.distance_km) : 0,
      created_by:  user?.id,
    }

    if (editItem) {
      const { error } = await supabase.from('distributors').update(payload).eq('id', editItem.id)
      if (error) toast.error('Failed to update')
      else { toast.success('Distributor updated'); fetchDistributors(); closeModal() }
    } else {
      const { error } = await supabase.from('distributors').insert(payload)
      if (error) toast.error('Failed to add')
      else { toast.success('Distributor added'); fetchDistributors(); closeModal() }
    }
    setSaving(false)
  }

  async function toggleActive(d) {
    const { error } = await supabase
      .from('distributors')
      .update({ is_active: !d.is_active })
      .eq('id', d.id)
    if (error) toast.error('Failed to update')
    else { toast.success(d.is_active ? 'Deactivated' : 'Activated'); fetchDistributors() }
  }

  // ── Product Prices ────────────────────────────────────────

  async function openPrices(distributorId) {
    setPriceModalId(distributorId)
    // Load existing prices
    const { data } = await supabase
      .from('distributor_product_prices')
      .select('*')
      .eq('distributor_id', distributorId)
    setExistingPrices(data || [])
    // Build price map: product_id -> price (default to product's sale_price)
    const map = {}
    products.forEach(p => {
      const existing = data?.find(e => e.product_id === p.id)
      map[p.id] = existing ? existing.price : p.sale_price
    })
    setPrices(map)
  }

  function closePrices() {
    setPriceModalId(null)
    setPrices({})
    setExistingPrices([])
  }

  async function savePrices() {
    if (!priceModalId) return
    setSavingPrices(true)
    const { data: { user } } = await supabase.auth.getUser()

    // Upsert all prices
    const rows = products.map(p => ({
      distributor_id: priceModalId,
      product_id:     p.id,
      price:          parseFloat(prices[p.id]) || parseFloat(p.sale_price),
      created_by:     user?.id,
    }))

    const { error } = await supabase
      .from('distributor_product_prices')
      .upsert(rows, { onConflict: 'distributor_id,product_id' })

    if (error) toast.error('Failed to save prices')
    else { toast.success('Prices saved'); closePrices() }
    setSavingPrices(false)
  }

  // ── Render ────────────────────────────────────────────────

  const filtered = distributors.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.route || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.phone || '').includes(search)
  )

  const priceDistributor = distributors.find(d => d.id === priceModalId)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Distributor Master</div>
          <div className="page-subtitle">
            {distributors.filter(d => d.is_active).length} active distributors
          </div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={15} /> Add Distributor
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16, maxWidth: 320 }}>
        <div className="search-wrap">
          <Search size={14} className="search-icon" />
          <input
            className="input search-input"
            placeholder="Search by name, route, phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch('')}>
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Route</th>
              <th>Distance</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}>
                <div className="table-loading">
                  <Loader2 size={20} className="spin" /> Loading…
                </div>
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7}>
                <div className="empty-state">
                  <Truck size={32} />
                  <p>{search ? 'No match found' : 'No distributors yet'}</p>
                </div>
              </td></tr>
            ) : (
              filtered.map((d, i) => (
                <tr key={d.id} style={{ opacity: d.is_active ? 1 : 0.55 }}>
                  <td className="text-faint">{i + 1}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="dist-icon">
                        <Truck size={13} />
                      </div>
                      <span style={{ fontWeight: 500 }}>{d.name}</span>
                    </div>
                  </td>
                  <td>
                    {d.phone
                      ? <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-2)' }}>
                          <Phone size={12} />{d.phone}
                        </span>
                      : <span className="text-faint">—</span>
                    }
                  </td>
                  <td>
                    {d.route
                      ? <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-2)' }}>
                          <MapPin size={12} />{d.route}
                        </span>
                      : <span className="text-faint">—</span>
                    }
                  </td>
                  <td>
                    {d.distance_km > 0
                      ? <span className="badge badge-blue">{d.distance_km} km</span>
                      : <span className="text-faint">—</span>
                    }
                  </td>
                  <td>
                    <span className={`badge ${d.is_active ? 'badge-green' : 'badge-red'}`}>
                      {d.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(d)}>
                        <Pencil size={12} /> Edit
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openPrices(d.id)}>
                        <IndianRupee size={12} /> Prices
                      </button>
                      <button
                        className={`btn btn-sm ${d.is_active ? 'btn-danger' : 'btn-ghost'}`}
                        onClick={() => toggleActive(d)}
                      >
                        <Power size={12} />
                        {d.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
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
                  {editItem ? 'Edit Distributor' : 'Add Distributor'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                  {editItem ? `Editing: ${editItem.name}` : 'Enter distributor details'}
                </div>
              </div>
              <button className="modal-close" onClick={closeModal}><X size={16} /></button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="label">Distributor Name *</label>
                  <input className="input" name="name" placeholder="e.g. Ramesh Traders"
                    value={form.name} onChange={handleChange} required autoFocus />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="label"><Phone size={11} style={{display:'inline',marginRight:4}} />Phone</label>
                    <input className="input" name="phone" placeholder="10-digit mobile"
                      value={form.phone} onChange={handleChange} maxLength={10} />
                  </div>
                  <div className="form-group">
                    <label className="label"><MapPin size={11} style={{display:'inline',marginRight:4}} />Route</label>
                    <input className="input" name="route" placeholder="e.g. North Zone"
                      value={form.route} onChange={handleChange} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="label">Address</label>
                  <input className="input" name="address" placeholder="Full address"
                    value={form.address} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="label">Distance from dairy (km)</label>
                  <input className="input" type="number" name="distance_km"
                    placeholder="0" min="0" step="0.1"
                    value={form.distance_km} onChange={handleChange} />
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5 }}>
                    Used to auto-calculate vehicle expenses for this route.
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving
                    ? <><Loader2 size={14} className="spin" /> Saving…</>
                    : <><Plus size={14} /> {editItem ? 'Save Changes' : 'Add Distributor'}</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Price Modal */}
      {priceModalId && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && closePrices()}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>
                  Product Prices
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                  {priceDistributor?.name} — set distributor-specific prices
                </div>
              </div>
              <button className="modal-close" onClick={closePrices}><X size={16} /></button>
            </div>

            <div className="modal-body">
              {products.length === 0 ? (
                <div className="empty-state" style={{ padding: 32 }}>
                  <p>No active products found. Add products first.</p>
                </div>
              ) : (
                <div className="prices-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Unit</th>
                        <th>Default Price</th>
                        <th>Distributor Price (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map(p => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 500 }}>{p.name}</td>
                          <td><span className="badge badge-orange">{p.unit}</span></td>
                          <td className="text-faint">₹{parseFloat(p.sale_price).toFixed(2)}</td>
                          <td>
                            <input
                              className="input"
                              type="number"
                              min="0"
                              step="0.01"
                              style={{ padding: '7px 10px', fontSize: 13 }}
                              value={prices[p.id] ?? ''}
                              onChange={e => setPrices(prev => ({
                                ...prev, [p.id]: e.target.value
                              }))}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closePrices}>Cancel</button>
              <button className="btn btn-primary" onClick={savePrices} disabled={savingPrices}>
                {savingPrices
                  ? <><Loader2 size={14} className="spin" /> Saving…</>
                  : <><Save size={14} /> Save Prices</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .search-wrap { position: relative; }
        .search-icon {
          position: absolute; left: 12px; top: 50%;
          transform: translateY(-50%);
          color: var(--text-3); pointer-events: none;
        }
        .search-input { padding-left: 36px; padding-right: 32px; }
        .search-clear {
          position: absolute; right: 10px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          color: var(--text-3); cursor: pointer; display: flex;
        }
        .dist-icon {
          width: 28px; height: 28px;
          border-radius: var(--r-sm);
          background: var(--surface-2);
          border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          color: var(--text-3); flex-shrink: 0;
        }
        .table-loading {
          display: flex; align-items: center; justify-content: center;
          gap: 10px; padding: 40px; color: var(--text-3);
        }
        .modal-close {
          width: 32px; height: 32px;
          border-radius: var(--r-sm);
          background: var(--surface-2); border: 1px solid var(--border);
          color: var(--text-2); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.14s;
        }
        .modal-close:hover { background: var(--surface-3); color: var(--text); }
        .prices-table-wrap { border-radius: var(--r-md); overflow: hidden; border: 1px solid var(--border); }
        :global(.spin) { animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
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

  .search-wrap {
    width: 100%;
  }

  .table-wrap {
    overflow-x: auto;
  }

  table {
    min-width: 950px;
  }

  .modal {
    width: calc(100vw - 24px);
    max-height: 90vh;
    overflow-y: auto;
  }

  .grid-2 {
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

  .dist-icon {
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
