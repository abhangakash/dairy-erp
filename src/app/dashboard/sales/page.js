'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, ShoppingCart, Save,
  Loader2, Calendar, Send, X, IndianRupee
} from 'lucide-react'
import { getWhatsAppLink, formatDistributorBill } from '@/lib/utils/whatsapp'

export default function SalesEntryPage() {
  const [distributors, setDistributors] = useState([])
  const [products, setProducts]         = useState([])
  const [saving, setSaving]             = useState(false)
  const [date, setDate]                 = useState(new Date().toISOString().split('T')[0])
  const [distributorId, setDistributorId] = useState('')
  const [rows, setRows]                 = useState([{ product_id: '', quantity: '', unit_price: '' }])
  const [notes, setNotes]               = useState('')
  const [todaySales, setTodaySales]     = useState([])
  const [billModal, setBillModal]       = useState(null) // sale object for bill preview
  const [prices, setPrices]             = useState({})  // { product_id: price } for selected distributor

  useEffect(() => {
    fetchDistributors()
    fetchProducts()
    fetchTodaySales(date)
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

  async function fetchTodaySales(forDate) {
    const { data } = await supabase
      .from('daily_sales')
      .select(`
        id, entry_date, notes, bill_sent, entered_at,
        distributors(id, name, phone),
        daily_sale_items(
          id, quantity, unit_price, total_amount,
          products(name, unit)
        )
      `)
      .eq('entry_date', forDate)
      .order('entered_at', { ascending: false })
    setTodaySales(data || [])
  }

  // When distributor changes, load their specific prices
  async function handleDistributorChange(distId) {
    setDistributorId(distId)
    if (!distId) { setPrices({}); return }

    const { data } = await supabase
      .from('distributor_product_prices')
      .select('product_id, price')
      .eq('distributor_id', distId)

    const priceMap = {}
    products.forEach(p => { priceMap[p.id] = p.sale_price }) // default
    ;(data || []).forEach(d => { priceMap[d.product_id] = d.price }) // override with distributor price
    setPrices(priceMap)

    // Auto-fill prices in rows
    setRows(r => r.map(row => ({
      ...row,
      unit_price: row.product_id ? (priceMap[row.product_id] || '') : row.unit_price
    })))
  }

  function addRow() {
    setRows(r => [...r, { product_id: '', quantity: '', unit_price: '' }])
  }

  function removeRow(i) {
    setRows(r => r.filter((_, idx) => idx !== i))
  }

  function updateRow(i, field, value) {
    setRows(prev => prev.map((row, idx) => {
      if (idx !== i) return row
      const updated = { ...row, [field]: value }
      // Auto-fill price when product selected
      if (field === 'product_id' && value && prices[value]) {
        updated.unit_price = prices[value]
      }
      return updated
    }))
  }

  const validRows = rows.filter(r => r.product_id && r.quantity && r.unit_price &&
    parseFloat(r.quantity) > 0 && parseFloat(r.unit_price) > 0)

  const billTotal = validRows.reduce((s, r) =>
    s + parseFloat(r.quantity || 0) * parseFloat(r.unit_price || 0), 0)

  async function handleSave() {
    if (!distributorId) { toast.error('Select a distributor'); return }
    if (validRows.length === 0) { toast.error('Add at least one product with quantity and price'); return }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    // Insert sale header
    const { data: sale, error: saleError } = await supabase
      .from('daily_sales')
      .insert({
        entry_date:     date,
        distributor_id: distributorId,
        notes:          notes || null,
        entered_by:     user?.id,
        entered_at:     new Date().toISOString(),
      })
      .select()
      .single()

    if (saleError) { toast.error('Failed to save sale: ' + saleError.message); setSaving(false); return }

    // Insert sale items
    const items = validRows.map(r => ({
      sale_id:    sale.id,
      product_id: r.product_id,
      quantity:   parseFloat(r.quantity),
      unit_price: parseFloat(r.unit_price),
    }))

    const { error: itemsError } = await supabase.from('daily_sale_items').insert(items)

    if (itemsError) {
      toast.error('Failed to save items: ' + itemsError.message)
      // Rollback sale header
      await supabase.from('daily_sales').delete().eq('id', sale.id)
      setSaving(false)
      return
    }

    toast.success('Sale saved!')
    setRows([{ product_id: '', quantity: '', unit_price: '' }])
    setDistributorId('')
    setNotes('')
    setPrices({})
    fetchTodaySales(date)

    // Prompt to send bill
    const dist = distributors.find(d => d.id === distributorId)
    setBillModal({
      saleId:      sale.id,
      distributor: dist,
      items:       validRows.map(r => {
        const p = products.find(pr => pr.id === r.product_id)
        return {
          product_name: p?.name,
          unit:         p?.unit,
          quantity:     parseFloat(r.quantity),
          unit_price:   parseFloat(r.unit_price),
        }
      }),
      date,
    })

    setSaving(false)
  }

  async function sendBillWhatsApp(sale) {
    if (!sale.distributor?.phone) {
      toast.error('No phone number for this distributor')
      return
    }

    // Get outstanding balance
    const { data: balance } = await supabase
      .from('v_distributor_balance')
      .select('outstanding, total_billed')
      .eq('distributor_id', sale.distributor.id)
      .single()

    const todayTotal = sale.items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
    const prevOutstanding = (balance?.outstanding || 0) - todayTotal

    const message = formatDistributorBill({
      distributor: sale.distributor,
      items:       sale.items,
      outstanding: {
        previous: Math.max(0, prevOutstanding),
        total:    balance?.outstanding || todayTotal,
      },
      date: new Date(sale.date).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric'
      }),
    })

    const link = getWhatsAppLink(sale.distributor.phone, message)
    window.open(link, '_blank')

    // Mark bill as sent
    await supabase.from('daily_sales').update({ bill_sent: true }).eq('id', sale.saleId)
    fetchTodaySales(date)
    setBillModal(null)
    toast.success('WhatsApp bill opened!')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Daily Sales Entry</div>
          <div className="page-subtitle">Record sales to distributors and send bill on WhatsApp</div>
        </div>
        <div className="date-picker-wrap">
          <Calendar size={14} className="date-icon" />
          <input type="date" className="input date-input"
            value={date}
            onChange={e => { setDate(e.target.value); fetchTodaySales(e.target.value) }}
            max={new Date().toISOString().split('T')[0]} />
        </div>
      </div>

      <div className="sales-layout">
        {/* Entry form */}
        <div className="card entry-card">
          <div className="entry-header">
            <ShoppingCart size={16} color="var(--blue)" />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>New Sale Entry</span>
          </div>

          {/* Distributor select */}
          <div className="form-group">
            <label className="label">Distributor *</label>
            <select className="input" value={distributorId}
              onChange={e => handleDistributorChange(e.target.value)}>
              <option value="">— Select distributor —</option>
              {distributors.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}{d.route ? ` (${d.route})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Product rows */}
          <div className="row-headers">
            <span>Product *</span>
            <span>Qty *</span>
            <span>Unit Price (₹) *</span>
            <span>Total</span>
            <span></span>
          </div>

          <div className="entry-rows">
            {rows.map((row, i) => {
              const product   = products.find(p => p.id === row.product_id)
              const rowTotal  = (parseFloat(row.quantity) || 0) * (parseFloat(row.unit_price) || 0)
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

                  <div className="row-total">
                    {rowTotal > 0
                      ? <span>₹{rowTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      : <span className="text-faint">—</span>
                    }
                  </div>

                  <button className="remove-btn" onClick={() => removeRow(i)}
                    disabled={rows.length === 1}>
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Add row */}
          <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={addRow}>
            <Plus size={14} /> Add Product
          </button>

          {/* Notes */}
          <div className="form-group" style={{ marginTop: 16 }}>
            <label className="label">Notes (optional)</label>
            <input className="input" placeholder="Any note for this sale…"
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {/* Bill total + save */}
          {billTotal > 0 && (
            <div className="bill-total-bar">
              <span className="text-muted">Bill Total</span>
              <span className="bill-total-val">
                ₹{billTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          <div className="entry-footer">
            <div className="audit-notice">Saved with user ID · timestamp · IP address</div>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving
                ? <><Loader2 size={14} className="spin" /> Saving…</>
                : <><Save size={14} /> Save & Generate Bill</>
              }
            </button>
          </div>
        </div>

        {/* Today's sales list */}
        <div className="today-sales">
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="today-header">
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>
                Today's Sales
              </div>
              <span className="badge badge-blue">{todaySales.length} bills</span>
            </div>

            {todaySales.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px 0' }}>
                <ShoppingCart size={28} />
                <p>No sales entries for this date</p>
              </div>
            ) : (
              <div className="sale-list">
                {todaySales.map(sale => {
                  const saleTotal = sale.daily_sale_items?.reduce((s, i) => s + parseFloat(i.total_amount || 0), 0) || 0
                  return (
                    <div key={sale.id} className="sale-card">
                      <div className="sale-card-header">
                        <div className="sale-dist-name">{sale.distributors?.name}</div>
                        <div className="sale-total">₹{saleTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div className="sale-items-list">
                        {sale.daily_sale_items?.map(item => (
                          <div key={item.id} className="sale-item-row">
                            <span>{item.products?.name}</span>
                            <span className="text-faint">{parseFloat(item.quantity)} {item.products?.unit} × ₹{parseFloat(item.unit_price)}</span>
                            <span style={{ fontWeight: 500 }}>₹{parseFloat(item.total_amount).toLocaleString('en-IN')}</span>
                          </div>
                        ))}
                      </div>
                      <div className="sale-card-footer">
                        <span className="text-faint" style={{ fontSize: 11 }}>
                          {new Date(sale.entered_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {sale.bill_sent
                          ? <span className="badge badge-green" style={{ fontSize: 10 }}>Bill Sent ✓</span>
                          : (
                            <button className="btn btn-ghost btn-sm whatsapp-btn"
                              onClick={() => setBillModal({
                                saleId:      sale.id,
                                distributor: sale.distributors,
                                items:       sale.daily_sale_items?.map(i => ({
                                  product_name: i.products?.name,
                                  unit:         i.products?.unit,
                                  quantity:     parseFloat(i.quantity),
                                  unit_price:   parseFloat(i.unit_price),
                                })),
                                date,
                              })}>
                              <Send size={12} /> Send Bill
                            </button>
                          )
                        }
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bill Preview Modal */}
      {billModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setBillModal(null)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>
                  WhatsApp Bill Preview
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                  {billModal.distributor?.name}
                </div>
              </div>
              <button className="modal-close" onClick={() => setBillModal(null)}><X size={16} /></button>
            </div>

            <div className="modal-body">
              <div className="bill-preview">
                <div className="bill-line bill-title">🥛 DAIRY ERP — SALE BILL</div>
                <div className="bill-divider">━━━━━━━━━━━━━━━━━━━━</div>
                <div className="bill-line">📅 Date: {new Date(billModal.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                <div className="bill-line">👤 Distributor: {billModal.distributor?.name}</div>
                <div className="bill-divider">━━━━━━━━━━━━━━━━━━━━</div>
                <div className="bill-line bill-section">ITEMS</div>
                {billModal.items?.map((item, i) => (
                  <div key={i} className="bill-line">
                    • {item.product_name}  {item.quantity} {item.unit}  @₹{item.unit_price}  = <strong>₹{(item.quantity * item.unit_price).toFixed(2)}</strong>
                  </div>
                ))}
                <div className="bill-divider">━━━━━━━━━━━━━━━━━━━━</div>
                <div className="bill-line bill-total-line">
                  💰 Today's Bill: <strong>₹{billModal.items?.reduce((s, i) => s + i.quantity * i.unit_price, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
                <div className="bill-divider">━━━━━━━━━━━━━━━━━━━━</div>
                <div className="bill-line">Thank you! 🙏</div>
              </div>

              {!billModal.distributor?.phone && (
                <div className="no-phone-warn">
                  ⚠️ No phone number saved for this distributor. Add phone in Distributor Master first.
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setBillModal(null)}>Close</button>
              <button
                className="btn btn-primary whatsapp-send-btn"
                onClick={() => sendBillWhatsApp(billModal)}
                disabled={!billModal.distributor?.phone}>
                <Send size={14} /> Open in WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .sales-layout {
          display: grid;
          grid-template-columns: 1fr 360px;
          gap: 20px;
          align-items: start;
        }
        .entry-card { }
        .entry-header {
          display: flex; align-items: center; gap: 10px;
          padding-bottom: 16px; margin-bottom: 16px;
          border-bottom: 1px solid var(--border);
        }
        .date-picker-wrap { position: relative; }
        .date-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-3); pointer-events: none; }
        .date-input { padding-left: 36px; width: 190px; }

        /* Row headers */
        .row-headers {
          display: grid;
          grid-template-columns: 1fr 130px 150px 110px 32px;
          gap: 8px;
          font-size: 11px; font-weight: 600;
          color: var(--text-3); text-transform: uppercase;
          letter-spacing: 0.06em; margin-bottom: 6px;
        }
        .entry-rows { display: flex; flex-direction: column; gap: 8px; }
        .entry-row {
          display: grid;
          grid-template-columns: 1fr 130px 150px 110px 32px;
          gap: 8px; align-items: center;
        }
        .qty-wrap { position: relative; }
        .qty-unit { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 11px; color: var(--text-3); pointer-events: none; }
        .price-wrap { position: relative; display: flex; align-items: center; }
        .price-rupee { position: absolute; left: 11px; font-size: 13px; color: var(--text-3); pointer-events: none; z-index: 1; }
        .price-input { padding-left: 24px; }
        .row-total { font-family: var(--font-display); font-size: 14px; font-weight: 600; color: var(--green); text-align: right; padding-right: 4px; }
        .remove-btn {
          width: 32px; height: 38px; border-radius: var(--r-sm);
          background: var(--surface-2); border: 1px solid var(--border);
          color: var(--text-3); cursor: pointer;
          display: flex; align-items: center; justify-content: center; transition: all 0.14s;
        }
        .remove-btn:hover:not(:disabled) { background: var(--red-dim); color: var(--red); }
        .remove-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        .bill-total-bar {
          display: flex; align-items: center; justify-content: space-between;
          background: var(--surface-2); border: 1px solid var(--border);
          border-radius: var(--r-md); padding: 12px 16px; margin-top: 16px;
        }
        .bill-total-val {
          font-family: var(--font-display); font-size: 20px;
          font-weight: 700; color: var(--green);
        }
        .entry-footer {
          display: flex; align-items: center; justify-content: space-between;
          margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);
        }
        .audit-notice { font-size: 11px; color: var(--text-3); }

        /* Today's sales */
        .today-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid var(--border);
        }
        .sale-list { display: flex; flex-direction: column; gap: 12px; }
        .sale-card {
          background: var(--surface-2); border: 1px solid var(--border);
          border-radius: var(--r-md); overflow: hidden;
        }
        .sale-card-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 14px; background: var(--surface-3);
          border-bottom: 1px solid var(--border);
        }
        .sale-dist-name { font-weight: 600; font-size: 13.5px; }
        .sale-total { font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--green); }
        .sale-items-list { padding: 8px 14px; display: flex; flex-direction: column; gap: 5px; }
        .sale-item-row { display: flex; justify-content: space-between; font-size: 12.5px; gap: 8px; }
        .sale-card-footer {
          display: flex; align-items: center; justify-content: space-between;
          padding: 8px 14px; border-top: 1px solid var(--border);
        }
        .whatsapp-btn { color: #25d366 !important; }
        .whatsapp-send-btn { background: #25d366 !important; }

        /* Bill preview */
        .bill-preview {
          background: var(--surface-2); border: 1px solid var(--border);
          border-radius: var(--r-md); padding: 16px 20px;
          font-family: monospace; font-size: 13px; line-height: 1.8;
          color: var(--text);
        }
        .bill-title { font-weight: 700; font-size: 14px; }
        .bill-divider { color: var(--text-3); margin: 2px 0; }
        .bill-section { font-weight: 700; color: var(--text-2); }
        .bill-total-line { color: var(--green); }
        .no-phone-warn {
          margin-top: 12px; font-size: 13px; color: var(--yellow);
          background: var(--yellow-dim); border-radius: var(--r-sm); padding: 10px 14px;
        }

        .modal-close {
          width: 32px; height: 32px; border-radius: var(--r-sm);
          background: var(--surface-2); border: 1px solid var(--border);
          color: var(--text-2); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        :global(.spin) { animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 1200px) {

  .sales-layout {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .today-sales {
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

  .row-headers {
    display: none;
  }

  .entry-row {
    grid-template-columns: 1fr;
    gap: 10px;

    padding: 14px;

    border: 1px solid var(--border);
    border-radius: var(--r-md);

    background: var(--surface-2);
  }

  .row-total {
    text-align: left;
    padding-right: 0;
    font-size: 15px;
  }

  .remove-btn {
    width: 100%;
    height: 40px;
  }

  .entry-footer {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .entry-footer .btn {
    width: 100%;
    justify-content: center;
  }

  .bill-total-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .sale-item-row {
    flex-wrap: wrap;
  }

  .sale-card-footer {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .sale-card-footer .btn {
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 640px) {

  .dashboard-content,
  .sales-layout,
  .entry-card,
  .today-sales,
  .card {
    width: 100%;
    min-width: 0;
  }

  .page-title {
    font-size: 20px;
  }

  .page-subtitle {
    font-size: 13px;
  }

  .bill-total-val {
    font-size: 18px;
  }

  .sale-card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .sale-total {
    font-size: 14px;
  }

  .modal {
    width: calc(100vw - 20px) !important;
    margin: 10px;
    max-width: unset !important;
  }

  .modal-footer {
    flex-direction: column;
    gap: 10px;
  }

  .modal-footer .btn {
    width: 100%;
    justify-content: center;
  }

  .bill-preview {
    padding: 14px;
    font-size: 12px;
    overflow-x: auto;
  }
}
      `}</style>
    </div>
  )
}