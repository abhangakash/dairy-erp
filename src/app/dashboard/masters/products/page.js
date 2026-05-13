'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  Plus, Pencil, Power, FlaskConical,
  Search, X, Loader2, Tag, Ruler, IndianRupee
} from 'lucide-react'

const UNITS = ['pcs', 'litre', 'kg', 'packet', 'cup', 'bottle', 'box']
const CATEGORIES = ['Lassi', 'Ice Cream', 'Milk', 'Curd', 'Butter', 'Paneer', 'Ghee', 'Other']

const EMPTY_FORM = { name: '', category: '', unit: 'pcs', sale_price: '' }

export default function ProductMasterPage() {
  const [products, setProducts]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [modalOpen, setModalOpen]   = useState(false)
  const [saving, setSaving]         = useState(false)
  const [editItem, setEditItem]     = useState(null) // null = add mode
  const [form, setForm]             = useState(EMPTY_FORM)
  const [filterActive, setFilterActive] = useState('all') // all | active | inactive

  useEffect(() => { fetchProducts() }, [])

  async function fetchProducts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) toast.error('Failed to load products')
    else setProducts(data || [])
    setLoading(false)
  }

  function openAdd() {
    setEditItem(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(product) {
    setEditItem(product)
    setForm({
      name:       product.name,
      category:   product.category || '',
      unit:       product.unit,
      sale_price: product.sale_price,
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
    if (!form.name.trim()) { toast.error('Product name is required'); return }
    if (!form.sale_price || isNaN(form.sale_price)) { toast.error('Enter a valid price'); return }

    setSaving(true)

    // Get current user for created_by
    const { data: { user } } = await supabase.auth.getUser()

    const payload = {
      name:       form.name.trim(),
      category:   form.category || null,
      unit:       form.unit,
      sale_price: parseFloat(form.sale_price),
      created_by: user?.id,
    }

    if (editItem) {
      const { error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', editItem.id)
      if (error) toast.error('Failed to update product')
      else { toast.success('Product updated'); fetchProducts(); closeModal() }
    } else {
      const { error } = await supabase
        .from('products')
        .insert(payload)
      if (error) toast.error('Failed to add product')
      else { toast.success('Product added'); fetchProducts(); closeModal() }
    }

    setSaving(false)
  }

  async function toggleActive(product) {
    const { error } = await supabase
      .from('products')
      .update({ is_active: !product.is_active })
      .eq('id', product.id)
    if (error) toast.error('Failed to update status')
    else {
      toast.success(product.is_active ? 'Product deactivated' : 'Product activated')
      fetchProducts()
    }
  }

  // Filtered list
  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.category || '').toLowerCase().includes(search.toLowerCase())
    const matchActive =
      filterActive === 'all'      ? true :
      filterActive === 'active'   ? p.is_active :
      !p.is_active
    return matchSearch && matchActive
  })

  const counts = {
    all:      products.length,
    active:   products.filter(p => p.is_active).length,
    inactive: products.filter(p => !p.is_active).length,
  }

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">Product Master</div>
          <div className="page-subtitle">
            {counts.active} active products · {counts.inactive} inactive
          </div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={15} />
          Add Product
        </button>
      </div>

      {/* Filters bar */}
      <div className="filters-bar">
        <div className="search-wrap">
          <Search size={14} className="search-icon" />
          <input
            className="input search-input"
            placeholder="Search products…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch('')}>
              <X size={13} />
            </button>
          )}
        </div>

        <div className="filter-tabs">
          {['all', 'active', 'inactive'].map(f => (
            <button
              key={f}
              className={`filter-tab ${filterActive === f ? 'filter-tab-active' : ''}`}
              onClick={() => setFilterActive(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="filter-count">{counts[f]}</span>
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
              <th>Product Name</th>
              <th>Category</th>
              <th>Unit</th>
              <th>Sale Price</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7}>
                  <div className="table-loading">
                    <Loader2 size={20} className="spin" />
                    Loading products…
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <FlaskConical size={32} />
                    <p>{search ? 'No products match your search' : 'No products yet — add one above'}</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((p, i) => (
                <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.55 }}>
                  <td className="text-faint">{i + 1}</td>
                  <td>
                    <div className="product-name-cell">
                      <div className="product-icon">
                        <FlaskConical size={14} />
                      </div>
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                    </div>
                  </td>
                  <td>
                    {p.category
                      ? <span className="badge badge-blue">{p.category}</span>
                      : <span className="text-faint">—</span>
                    }
                  </td>
                  <td>
                    <span className="badge badge-orange">{p.unit}</span>
                  </td>
                  <td>
                    <span className="price-cell">
                      ₹{parseFloat(p.sale_price).toFixed(2)}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${p.is_active ? 'badge-green' : 'badge-red'}`}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="action-btns">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => openEdit(p)}
                        title="Edit"
                      >
                        <Pencil size={13} />
                        Edit
                      </button>
                      <button
                        className={`btn btn-sm ${p.is_active ? 'btn-danger' : 'btn-ghost'}`}
                        onClick={() => toggleActive(p)}
                        title={p.is_active ? 'Deactivate' : 'Activate'}
                      >
                        <Power size={13} />
                        {p.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-header">
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>
                  {editItem ? 'Edit Product' : 'Add New Product'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                  {editItem ? `Editing: ${editItem.name}` : 'Fill in product details'}
                </div>
              </div>
              <button className="modal-close" onClick={closeModal}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body">
                {/* Name */}
                <div className="form-group">
                  <label className="label">
                    <Tag size={11} style={{ display: 'inline', marginRight: 4 }} />
                    Product Name *
                  </label>
                  <input
                    className="input"
                    name="name"
                    placeholder="e.g. Mango Lassi, Vanilla Ice Cream"
                    value={form.name}
                    onChange={handleChange}
                    required
                    autoFocus
                  />
                </div>

                <div className="grid-2">
                  {/* Category */}
                  <div className="form-group">
                    <label className="label">Category</label>
                    <select className="input" name="category" value={form.category} onChange={handleChange}>
                      <option value="">— Select —</option>
                      {CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Unit */}
                  <div className="form-group">
                    <label className="label">
                      <Ruler size={11} style={{ display: 'inline', marginRight: 4 }} />
                      Unit *
                    </label>
                    <select className="input" name="unit" value={form.unit} onChange={handleChange}>
                      {UNITS.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Sale Price */}
                <div className="form-group">
                  <label className="label">
                    <IndianRupee size={11} style={{ display: 'inline', marginRight: 4 }} />
                    Default Sale Price (₹) *
                  </label>
                  <input
                    className="input"
                    type="number"
                    name="sale_price"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={form.sale_price}
                    onChange={handleChange}
                    required
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5 }}>
                    This is the default price. Distributor-specific prices are set in Distributor Master.
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving
                    ? <><Loader2 size={14} className="spin" /> Saving…</>
                    : <><Plus size={14} /> {editItem ? 'Save Changes' : 'Add Product'}</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .filters-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .search-wrap {
          position: relative;
          flex: 1;
          min-width: 200px;
          max-width: 320px;
        }
        .search-icon {
          position: absolute;
          left: 12px; top: 50%;
          transform: translateY(-50%);
          color: var(--text-3);
          pointer-events: none;
        }
        .search-input {
          padding-left: 36px;
          padding-right: 32px;
        }
        .search-clear {
          position: absolute;
          right: 10px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          color: var(--text-3); cursor: pointer;
          display: flex;
        }

        .filter-tabs {
          display: flex;
          gap: 4px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          padding: 3px;
        }
        .filter-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: var(--r-sm);
          font-size: 13px;
          color: var(--text-2);
          background: none;
          border: none;
          cursor: pointer;
          transition: all 0.14s;
        }
        .filter-tab:hover { color: var(--text); }
        .filter-tab-active {
          background: var(--surface-3);
          color: var(--text);
          font-weight: 500;
        }
        .filter-count {
          font-size: 10px;
          background: var(--surface-3);
          color: var(--text-3);
          padding: 1px 6px;
          border-radius: 99px;
        }
        .filter-tab-active .filter-count {
          background: var(--brand-glow);
          color: var(--brand);
        }

        .product-name-cell {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .product-icon {
          width: 28px; height: 28px;
          border-radius: var(--r-sm);
          background: var(--surface-2);
          border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          color: var(--text-3);
          flex-shrink: 0;
        }

        .price-cell {
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 600;
          color: var(--green);
        }

        .action-btns {
          display: flex;
          gap: 6px;
        }

        .table-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 40px;
          color: var(--text-3);
        }

        .modal-close {
          width: 32px; height: 32px;
          border-radius: var(--r-sm);
          background: var(--surface-2);
          border: 1px solid var(--border);
          color: var(--text-2);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.14s;
        }
        .modal-close:hover {
          background: var(--surface-3);
          color: var(--text);
        }

        :global(.spin) {
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
      }
