'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  FlaskConical,
  Search,
  Calendar,
  Download,
  Loader2,
  Trash2,
  TrendingUp
} from 'lucide-react'

export default function ProductionHistoryPage() {
  const today = new Date().toISOString().split('T')[0]
  const monthStart = today.slice(0, 8) + '01'

  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState(monthStart)
  const [toDate, setToDate] = useState(today)
  const [productFilter, setProductFilter] = useState('')
  const [products, setProducts] = useState([])

  useEffect(() => {
    fetchProducts()
    fetchHistory()
  }, [])

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('id, name')
      .eq('is_active', true)
      .order('name')

    setProducts(data || [])
  }

  async function fetchHistory() {
    setLoading(true)

    let query = supabase
      .from('daily_production')
      .select(`
        id,
        entry_date,
        batch_no,
        quantity,
        notes,
        entered_at,
        ip_address,
        products(id, name, unit, category),
        entered_by_profile:profiles!daily_production_entered_by_fkey(full_name)
      `)
      .gte('entry_date', fromDate)
      .lte('entry_date', toDate)
      .order('entry_date', { ascending: false })
      .order('entered_at', { ascending: false })

    if (productFilter) {
      query = query.eq('product_id', productFilter)
    }

    const { data, error } = await query

    if (error) {
      console.log('HISTORY ERROR:', JSON.stringify(error))
      toast.error('Failed to load history')
    } else {
      setRecords(data || [])
    }

    setLoading(false)
  }

  async function deleteEntry(id) {
    if (
      !confirm(
        'Delete this production entry? Raw material stock will be restored.'
      )
    )
      return

    const { error } = await supabase
      .from('daily_production')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error('Failed to delete')
    } else {
      toast.success('Deleted — stock restored')
      fetchHistory()
    }
  }

  // Summary stats
  const totalBatches = records.length

  const totalByProduct = {}

  records.forEach((r) => {
    const name = r.products?.name || 'Unknown'
    const unit = r.products?.unit || ''

    if (!totalByProduct[name]) {
      totalByProduct[name] = { total: 0, unit }
    }

    totalByProduct[name].total += parseFloat(r.quantity || 0)
  })

  // Export CSV
  function exportCSV() {
    if (records.length === 0) {
      toast.error('No data to export')
      return
    }

    const header = [
      'Date',
      'Product',
      'Category',
      'Batch No',
      'Quantity',
      'Unit',
      'Notes',
      'Entered By',
      'Time'
    ]

    const rows = records.map((r) => [
      r.entry_date,
      r.products?.name || '',
      r.products?.category || '',
      r.batch_no,
      r.quantity,
      r.products?.unit || '',
      r.notes || '',
      r.entered_by_profile?.full_name || '',
      new Date(r.entered_at).toLocaleString('en-IN')
    ])

    const csv = [header, ...rows]
      .map((r) => r.join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })

    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')

    a.href = url
    a.download = `production_${fromDate}_to_${toDate}.csv`
    a.click()

    URL.revokeObjectURL(url)

    toast.success('CSV exported')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Production History</div>
          <div className="page-subtitle">
            {totalBatches} batches in selected range
          </div>
        </div>

        <button className="btn btn-ghost" onClick={exportCSV}>
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div
        className="filters-bar card"
        style={{ padding: 16, marginBottom: 20 }}
      >
        <div className="filters-inner">
          <div className="filter-field">
            <label className="label">From Date</label>

            <div className="date-wrap">
              <Calendar size={13} className="date-icon" />

              <input
                type="date"
                className="input date-input"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
          </div>

          <div className="filter-field">
            <label className="label">To Date</label>

            <div className="date-wrap">
              <Calendar size={13} className="date-icon" />

              <input
                type="date"
                className="input date-input"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>

          <div className="filter-field filter-field-product">
            <label className="label">Product</label>

            <select
              className="input"
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
            >
              <option value="">All Products</option>

              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-primary"
            style={{ alignSelf: 'flex-end' }}
            onClick={fetchHistory}
          >
            <Search size={14} />
            Search
          </button>
        </div>
      </div>

      {/* Summary */}
      {!loading && Object.keys(totalByProduct).length > 0 && (
        <div className="summary-strip">
          <div className="summary-strip-label">
            <TrendingUp size={13} />
            Total Production
          </div>

          {Object.entries(totalByProduct).map(([name, d]) => (
            <div key={name} className="summary-chip">
              <span className="summary-chip-name">{name}</span>

              <span className="summary-chip-val">
                {d.total.toLocaleString('en-IN')} {d.unit}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Product</th>
              <th>Category</th>
              <th>Batch</th>
              <th>Quantity</th>
              <th>Notes</th>
              <th>Entered By</th>
              <th>Time</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9}>
                  <div className="table-loading">
                    <Loader2 size={20} className="spin" />
                    Loading…
                  </div>
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <div className="empty-state">
                    <FlaskConical size={28} />
                    <p>No production records in this date range</p>
                  </div>
                </td>
              </tr>
            ) : (
              records.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span style={{ fontWeight: 500 }}>
                      {new Date(r.entry_date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </td>

                  <td>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}
                    >
                      <div className="prod-icon">
                        <FlaskConical size={12} />
                      </div>

                      <span style={{ fontWeight: 500 }}>
                        {r.products?.name}
                      </span>
                    </div>
                  </td>

                  <td>
                    {r.products?.category ? (
                      <span className="badge badge-blue">
                        {r.products.category}
                      </span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>

                  <td>
                    <span className="badge badge-orange">
                      Batch {r.batch_no}
                    </span>
                  </td>

                  <td>
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: 15,
                        color: 'var(--green)'
                      }}
                    >
                      {parseFloat(r.quantity).toLocaleString('en-IN')}
                    </span>

                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--text-3)',
                        marginLeft: 3
                      }}
                    >
                      {r.products?.unit}
                    </span>
                  </td>

                  <td style={{ color: 'var(--text-2)', fontSize: 13 }}>
                    {r.notes || (
                      <span className="text-faint">—</span>
                    )}
                  </td>

                  <td style={{ color: 'var(--text-2)', fontSize: 13 }}>
                    {r.entered_by_profile?.full_name || (
                      <span className="text-faint">—</span>
                    )}
                  </td>

                  <td style={{ color: 'var(--text-3)', fontSize: 12 }}>
                    {new Date(r.entered_at).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>

                  <td>
                    <button
                      className="delete-btn"
                      onClick={() => deleteEntry(r.id)}
                      title="Delete entry"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .filters-inner {
          display: flex;
          align-items: flex-end;
          gap: 14px;
          flex-wrap: wrap;
        }

        .filter-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .filter-field-product {
          flex: 1;
          min-width: 180px;
        }

        .date-wrap {
          position: relative;
        }

        .date-icon {
          position: absolute;
          left: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-3);
          pointer-events: none;
        }

        .date-input {
          padding-left: 32px;
          min-width: 160px;
        }

        .summary-strip {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 16px;
          padding: 12px 16px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
        }

        .summary-strip-label {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--text-3);
          margin-right: 4px;
        }

        .summary-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 99px;
          padding: 4px 12px;
          font-size: 12.5px;
        }

        .summary-chip-name {
          color: var(--text-2);
        }

        .summary-chip-val {
          font-family: var(--font-display);
          font-weight: 700;
          color: var(--green);
        }

        .table-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 40px;
          color: var(--text-3);
        }

        .prod-icon {
          width: 24px;
          height: 24px;
          border-radius: var(--r-sm);
          background: var(--green-dim);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--green);
          flex-shrink: 0;
        }

        .delete-btn {
          width: 28px;
          height: 28px;
          border-radius: var(--r-sm);
          background: none;
          border: 1px solid transparent;
          color: var(--text-3);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.12s;
        }

        .delete-btn:hover {
          background: var(--red-dim);
          border-color: rgba(248, 113, 113, 0.25);
          color: var(--red);
        }

        :global(.spin) {
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}