'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, ShoppingCart, Save,
  Loader2, Calendar, Send, X, IndianRupee
} from 'lucide-react'
import { generateSaleBillPDF, openPDFAndShareWhatsApp, downloadPDF, generateInvoiceNo } from '@/lib/utils/pdf'
import { formatDistributorBill, getWhatsAppLink } from '@/lib/utils/whatsapp'

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
    try {
      // Get outstanding balance
      const { data: balance } = await supabase
        .from('v_distributor_balance')
        .select('outstanding')
        .eq('distributor_id', sale.distributor.id)
        .single()

      const todayTotal      = sale.items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
      const totalOutstanding = parseFloat(balance?.outstanding || todayTotal)
      const prevOutstanding  = Math.max(0, totalOutstanding - todayTotal)

      const invoiceNo = generateInvoiceNo('MF-SL')
      const dateStr   = new Date(sale.date).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric'
      })

      // Generate PDF
      const doc = await generateSaleBillPDF({
        invoiceNo,
        date:                dateStr,
        distributor:         sale.distributor,
        items:               sale.items,
        previousOutstanding: prevOutstanding,
        totalOutstanding,
      })

      // Open PDF + WhatsApp
      openPDFAndShareWhatsApp(doc, sale.distributor?.phone, 'Sale Invoice')

      // Mark bill as sent
      await supabase.from('daily_sales').update({ bill_sent: true }).eq('id', sale.saleId)
      fetchTodaySales(date)
      setBillModal(null)
      toast.success('PDF invoice opened! WhatsApp opening shortly…')
    } catch (err) {
      toast.error('PDF generation failed — ' + err.message)
    }
  }

  async function downloadBill(sale) {
    try {
      const { data: balance } = await supabase
        .from('v_distributor_balance')
        .select('outstanding')
        .eq('distributor_id', sale.distributor.id)
        .single()

      const todayTotal      = sale.items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
      const totalOutstanding = parseFloat(balance?.outstanding || todayTotal)
      const prevOutstanding  = Math.max(0, totalOutstanding - todayTotal)

      const doc = await generateSaleBillPDF({
        invoiceNo:           generateInvoiceNo('MF-SL'),
        date:                new Date(sale.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
        distributor:         sale.distributor,
        items:               sale.items,
        previousOutstanding: prevOutstanding,
        totalOutstanding,
      })
      downloadPDF(doc, `MilkyFeast_Invoice_${sale.distributor?.name}_${sale.date}.pdf`)
      toast.success('Invoice downloaded!')
    } catch (err) {
      toast.error('Download failed: ' + err.message)
    }
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
                  Send Invoice
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                  {billModal.distributor?.name}
                </div>
              </div>
              <button className="modal-close" onClick={() => setBillModal(null)}><X size={16} /></button>
            </div>

            <div className="modal-body">
              {/* Invoice summary */}
              <div className="bill-summary">
                <div className="bill-summary-row">
                  <span className="text-muted">Distributor</span>
                  <span style={{ fontWeight: 600 }}>{billModal.distributor?.name}</span>
                </div>
                <div className="bill-summary-row">
                  <span className="text-muted">Date</span>
                  <span>{new Date(billModal.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
                <div className="bill-summary-row">
                  <span className="text-muted">Items</span>
                  <span>{billModal.items?.length} products</span>
                </div>
                <div className="bill-summary-row">
                  <span className="text-muted">Total</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--green)', fontSize: 16 }}>
                    ₹{billModal.items?.reduce((s, i) => s + i.quantity * i.unit_price, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 2 }}>Choose how to send — you can use both:</div>

                {/* Button 1: WhatsApp Message only */}
                <button
                  className="btn-action btn-whatsapp"
                  onClick={() => sendBillWhatsApp(billModal)}
                  disabled={!billModal.distributor?.phone}
                >
                  <div className="btn-action-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>1. Send WhatsApp Message</div>
                    <div style={{ fontSize: 11, opacity: 0.75 }}>Opens WhatsApp with pre-filled sale text message to {billModal.distributor?.phone || 'distributor'}</div>
                  </div>
                </button>

                {/* Button 2: Share PDF — downloads then device share sheet */}
                <button
                  className="btn-action btn-download"
                  onClick={() => downloadBill(billModal)}
                >
                  <div className="btn-action-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>2. Share Invoice PDF</div>
                    <div style={{ fontSize: 11, opacity: 0.75 }}>Downloads PDF to device — then open WhatsApp and attach it manually</div>
                  </div>
                </button>
              </div>

              {!billModal.distributor?.phone && (
                <div className="no-phone-warn" style={{ marginTop: 12 }}>
                  ⚠️ No phone number saved for this distributor. Add it in Distributor Master to use WhatsApp.
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setBillModal(null)}>Close</button>
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

        /* Bill modal */
        .bill-summary { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r-md); padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
        .bill-summary-row { display: flex; align-items: center; justify-content: space-between; font-size: 13px; }
        .btn-action {
          display: flex; align-items: center; gap: 14px;
          width: 100%; padding: 14px 16px; border-radius: var(--r-md);
          border: 1px solid; cursor: pointer; font-family: var(--font-body);
          transition: all 0.15s; text-align: left;
        }
        .btn-action-icon { width: 36px; height: 36px; border-radius: var(--r-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .btn-whatsapp { background: rgba(37,211,102,0.1); border-color: rgba(37,211,102,0.3); color: #128c7e; }
        .btn-whatsapp:hover { background: rgba(37,211,102,0.18); }
        .btn-whatsapp .btn-action-icon { background: rgba(37,211,102,0.15); }
        .btn-download { background: var(--blue-dim); border-color: rgba(96,165,250,0.3); color: var(--blue); }
        .btn-download:hover { background: rgba(96,165,250,0.15); }
        .btn-download .btn-action-icon { background: rgba(96,165,250,0.15); }
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

        @media (max-width: 960px) {
          .sales-layout { grid-template-columns: 1fr; }
          .row-headers { grid-template-columns: 1fr 110px 120px 32px; }
          .entry-row   { grid-template-columns: 1fr 110px 120px 32px; }
          .row-headers > span:nth-child(4),
          .entry-row > .row-total { display: none; }
        }
      `}</style>
    </div>
  )
}
