'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Package, AlertTriangle, CheckCircle2, Loader2, TrendingDown, TrendingUp } from 'lucide-react'

export default function RawMaterialStockPage() {
  const [stock, setStock]   = useState([])
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState([])

  useEffect(() => {
    fetchStock()
    fetchHistory()
  }, [])

  async function fetchStock() {
    setLoading(true)
    const { data } = await supabase
      .from('v_raw_material_stock')
      .select('*')
      .order('name')
    setStock(data || [])
    setLoading(false)
  }

  async function fetchHistory() {
    const { data } = await supabase
      .from('raw_material_stock_entries')
      .select('id, entry_date, quantity, unit_price, supplier, raw_materials(name, unit), profiles(full_name)')
      .order('entry_date', { ascending: false })
      .limit(20)
    setHistory(data || [])
  }

  const lowItems = stock.filter(s => s.is_low_stock)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Raw Material Stock</div>
          <div className="page-subtitle">
            {stock.length} materials · {lowItems.length} low on stock
          </div>
        </div>
        <a href="/dashboard/raw-materials/entry" className="btn btn-primary">
          <TrendingUp size={15} /> Add Stock Entry
        </a>
      </div>

      {/* Low stock alerts */}
      {lowItems.length > 0 && (
        <div className="low-stock-banner">
          <AlertTriangle size={16} />
          <div>
            <strong>Low Stock Alert</strong> — the following materials need reordering:{' '}
            {lowItems.map(s => (
              <span key={s.id} className="low-chip">
                {s.name} ({parseFloat(s.current_stock).toFixed(2)} {s.unit} left)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stock grid */}
      {loading ? (
        <div className="loading-state"><Loader2 size={22} className="spin" /> Loading stock…</div>
      ) : (
        <div className="stock-grid">
          {stock.map(s => {
            const pct = s.low_stock_alert > 0
              ? Math.min(100, (s.current_stock / (s.low_stock_alert * 3)) * 100)
              : 100
            return (
              <div key={s.id} className={`stock-card ${s.is_low_stock ? 'stock-card-low' : ''}`}>
                <div className="stock-card-header">
                  <div className="stock-icon">
                    <Package size={16} color={s.is_low_stock ? 'var(--red)' : 'var(--blue)'} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="stock-name">{s.name}</div>
                    <span className="badge badge-orange" style={{ fontSize: 10 }}>{s.unit}</span>
                  </div>
                  {s.is_low_stock
                    ? <AlertTriangle size={16} color="var(--red)" />
                    : <CheckCircle2 size={16} color="var(--green)" />
                  }
                </div>

                <div className="stock-qty">
                  <span className={`stock-qty-val ${s.is_low_stock ? 'text-red' : 'text-green'}`}>
                    {parseFloat(s.current_stock).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-faint" style={{ fontSize: 13 }}>{s.unit}</span>
                </div>

                <div className="stock-progress-wrap">
                  <div className="stock-progress">
                    <div
                      className="stock-progress-fill"
                      style={{
                        width: `${pct}%`,
                        background: s.is_low_stock ? 'var(--red)' : pct < 50 ? 'var(--yellow)' : 'var(--green)'
                      }}
                    />
                  </div>
                </div>

                <div className="stock-threshold">
                  Alert below: {parseFloat(s.low_stock_alert).toLocaleString('en-IN')} {s.unit}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Recent stock entries */}
      <div style={{ marginTop: 28 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, marginBottom: 14 }}>
          Recent Stock Entries
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Material</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
                <th>Supplier</th>
                <th>Entered By</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={7}>
                  <div className="empty-state" style={{ padding: 30 }}>
                    <Package size={24} /><p>No stock entries yet</p>
                  </div>
                </td></tr>
              ) : history.map(h => (
                <tr key={h.id}>
                  <td style={{ fontWeight: 500 }}>
                    {new Date(h.entry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ fontWeight: 500 }}>{h.raw_materials?.name}</td>
                  <td>
                    <span className="text-green" style={{ fontWeight: 600 }}>
                      +{parseFloat(h.quantity).toLocaleString('en-IN')}
                    </span>
                    <span className="text-faint" style={{ marginLeft: 4 }}>{h.raw_materials?.unit}</span>
                  </td>
                  <td>{h.unit_price ? `₹${parseFloat(h.unit_price).toFixed(2)}` : <span className="text-faint">—</span>}</td>
                  <td style={{ color: 'var(--text)', fontWeight: 500 }}>
                    {h.unit_price ? `₹${(h.quantity * h.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : <span className="text-faint">—</span>}
                  </td>
                  <td style={{ color: 'var(--text-2)' }}>{h.supplier || <span className="text-faint">—</span>}</td>
                  <td style={{ color: 'var(--text-2)' }}>{h.profiles?.full_name || <span className="text-faint">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
        .low-stock-banner {
          display: flex; align-items: flex-start; gap: 12px;
          background: var(--red-dim); border: 1px solid rgba(248,113,113,0.3);
          border-radius: var(--r-md); padding: 14px 18px; color: var(--red);
          font-size: 13px; margin-bottom: 20px; line-height: 1.6;
        }
        .low-chip {
          display: inline-block; background: rgba(248,113,113,0.15);
          border-radius: 99px; padding: 1px 8px; margin: 2px 3px;
          font-size: 12px; font-weight: 500;
        }
        .loading-state { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 60px; color: var(--text-3); }
        .stock-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }
        .stock-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); padding: 18px;
          display: flex; flex-direction: column; gap: 12px;
          transition: border-color 0.14s;
        }
        .stock-card-low { border-color: rgba(248,113,113,0.4); background: rgba(248,113,113,0.03); }
        .stock-card-header { display: flex; align-items: flex-start; gap: 10px; }
        .stock-icon {
          width: 36px; height: 36px; border-radius: var(--r-sm);
          background: var(--surface-2); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .stock-name { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
        .stock-qty { display: flex; align-items: baseline; gap: 6px; }
        .stock-qty-val { font-family: var(--font-display); font-size: 26px; font-weight: 700; }
        .stock-progress-wrap { }
        .stock-progress { height: 6px; background: var(--surface-2); border-radius: 99px; overflow: hidden; }
        .stock-progress-fill { height: 100%; border-radius: 99px; transition: width 0.4s ease; }
        .stock-threshold { font-size: 11px; color: var(--text-3); }
        :global(.spin) { animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}