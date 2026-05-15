'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, Receipt, Save,
  Loader2, Calendar, X, IndianRupee, Tag
} from 'lucide-react'

export default function ExpensesPage() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [date, setDate]             = useState(new Date().toISOString().split('T')[0])
  const [rows, setRows]             = useState([{ category_id: '', custom_category: '', amount: '', notes: '' }])
  const [todayExpenses, setTodayExpenses] = useState([])

  useEffect(() => {
    fetchCategories()
    fetchTodayExpenses(date)
  }, [])

  async function fetchCategories() {
    const { data } = await supabase
      .from('expense_categories')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
    setCategories(data || [])
  }

  async function fetchTodayExpenses(forDate) {
    const { data } = await supabase
      .from('daily_expenses')
      .select('id, entry_date, amount, notes, entered_at, category_id, custom_category, expense_categories(name), profiles(full_name)')
      .eq('entry_date', forDate)
      .order('entered_at', { ascending: false })
    setTodayExpenses(data || [])
  }

  function addRow() {
    setRows(r => [...r, { category_id: '', custom_category: '', amount: '', notes: '' }])
  }

  function removeRow(i) {
    setRows(r => r.filter((_, idx) => idx !== i))
  }

  function updateRow(i, field, value) {
    setRows(prev => prev.map((row, idx) => {
      if (idx !== i) return row
      const updated = { ...row, [field]: value }
      // Clear custom if category selected
      if (field === 'category_id' && value) updated.custom_category = ''
      // Clear category if typing custom
      if (field === 'custom_category' && value) updated.category_id = ''
      return updated
    }))
  }

  async function handleSave() {
    const valid = rows.filter(r =>
      (r.category_id || r.custom_category.trim()) && r.amount && parseFloat(r.amount) > 0
    )
    if (valid.length === 0) {
      toast.error('Add at least one expense with category and amount')
      return
    }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    // For each custom_category not in master, add it first
    for (const row of valid) {
      if (row.custom_category.trim() && !row.category_id) {
        const name = row.custom_category.trim()
        // Upsert into master
        const { data: cat } = await supabase
          .from('expense_categories')
          .upsert({ name, created_by: user?.id }, { onConflict: 'name' })
          .select('id')
          .single()
        // Assign the id back
        row.category_id    = cat?.id || null
        row.custom_category = null
      }
    }

    const inserts = valid.map(r => ({
      entry_date:       date,
      category_id:      r.category_id   || null,
      custom_category:  r.category_id   ? null : r.custom_category || null,
      amount:           parseFloat(r.amount),
      notes:            r.notes || null,
      entered_by:       user?.id,
      entered_at:       new Date().toISOString(),
    }))

    const { error } = await supabase.from('daily_expenses').insert(inserts)

    if (error) {
      toast.error('Failed to save: ' + error.message)
    } else {
      toast.success(`${inserts.length} expense${inserts.length > 1 ? 's' : ''} saved`)
      setRows([{ category_id: '', custom_category: '', amount: '', notes: '' }])
      fetchCategories() // refresh — new "Other" entries now in master
      fetchTodayExpenses(date)
    }
    setSaving(false)
  }

  async function deleteExpense(id) {
    if (!confirm('Delete this expense?')) return
    const { error } = await supabase.from('daily_expenses').delete().eq('id', id)
    if (error) toast.error('Failed')
    else { toast.success('Deleted'); fetchTodayExpenses(date) }
  }

  const todayTotal = todayExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Daily Expenses</div>
          <div className="page-subtitle">Record daily purchases like water, milk, fuel, etc.</div>
        </div>
        <div className="date-wrap">
          <Calendar size={14} className="date-icon" />
          <input type="date" className="input date-input"
            value={date}
            onChange={e => { setDate(e.target.value); fetchTodayExpenses(e.target.value) }}
            max={new Date().toISOString().split('T')[0]} />
        </div>
      </div>

      <div className="expenses-layout">
        {/* Entry form */}
        <div className="card entry-card">
          <div className="entry-header">
            <Receipt size={16} color="var(--brand)" />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>Add Expenses</span>
          </div>

          <div className="row-headers">
            <span>Category *</span>
            <span>Amount (₹) *</span>
            <span>Notes</span>
            <span></span>
          </div>

          <div className="entry-rows">
            {rows.map((row, i) => (
              <div key={i} className="entry-row">
                {/* Category — dropdown + Other text */}
                <div className="cat-field">
                  <select
                    className="input"
                    value={row.category_id}
                    onChange={e => updateRow(i, 'category_id', e.target.value)}
                  >
                    <option value="">— Select or type below —</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {!row.category_id && (
                    <input
                      className="input"
                      style={{ marginTop: 6, fontSize: 13 }}
                      placeholder="Or type new category…"
                      value={row.custom_category}
                      onChange={e => updateRow(i, 'custom_category', e.target.value)}
                    />
                  )}
                </div>

                {/* Amount */}
                <div className="amount-wrap">
                  <span className="rupee-sign">₹</span>
                  <input
                    type="number"
                    className="input amount-input"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={row.amount}
                    onChange={e => updateRow(i, 'amount', e.target.value)}
                  />
                </div>

                {/* Notes */}
                <input
                  type="text"
                  className="input"
                  placeholder="Note…"
                  value={row.notes}
                  onChange={e => updateRow(i, 'notes', e.target.value)}
                />

                {/* Remove */}
                <button className="remove-btn" onClick={() => removeRow(i)} disabled={rows.length === 1}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={addRow}>
            <Plus size={14} /> Add Another Expense
          </button>

          <div className="other-hint">
            💡 Type a new category name in "Or type new category…" — it will be automatically added to the master list for future use.
          </div>

          <div className="entry-footer">
            <div className="audit-notice">Saved with user ID · timestamp · IP</div>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving
                ? <><Loader2 size={14} className="spin" /> Saving…</>
                : <><Save size={14} /> Save Expenses</>
              }
            </button>
          </div>
        </div>

        {/* Today's summary */}
        <div className="card today-card">
          <div className="today-header">
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>
              Today's Expenses
            </div>
            <div className="today-total">
              ₹{todayTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          {todayExpenses.length === 0 ? (
            <div className="empty-state" style={{ padding: '28px 0' }}>
              <Receipt size={28} />
              <p>No expenses for this date</p>
            </div>
          ) : (
            <div className="today-list">
              {todayExpenses.map(e => (
                <div key={e.id} className="today-row">
                  <div className="today-cat-icon">
                    <Tag size={12} />
                  </div>
                  <div className="today-row-info">
                    <span className="today-cat-name">
                      {e.expense_categories?.name || e.custom_category || '—'}
                    </span>
                    {e.notes && <span className="today-note">{e.notes}</span>}
                  </div>
                  <span className="today-amount">
                    ₹{parseFloat(e.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <button className="delete-btn" onClick={() => deleteExpense(e.id)}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .expenses-layout {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 20px; align-items: start;
        }
        .date-wrap { position: relative; }
        .date-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-3); pointer-events: none; }
        .date-input { padding-left: 36px; width: 180px; }

        .entry-header { display: flex; align-items: center; gap: 10px; padding-bottom: 16px; margin-bottom: 16px; border-bottom: 1px solid var(--border); }

        .row-headers {
          display: grid;
          grid-template-columns: 1fr 140px 1fr 32px;
          gap: 10px; font-size: 11px; font-weight: 600;
          color: var(--text-3); text-transform: uppercase;
          letter-spacing: 0.06em; margin-bottom: 6px;
        }
        .entry-rows { display: flex; flex-direction: column; gap: 12px; }
        .entry-row {
          display: grid;
          grid-template-columns: 1fr 140px 1fr 32px;
          gap: 10px; align-items: start;
        }
        .cat-field { display: flex; flex-direction: column; }
        .amount-wrap { position: relative; }
        .rupee-sign { position: absolute; left: 11px; top: 11px; font-size: 13px; color: var(--text-3); }
        .amount-input { padding-left: 26px; }
        .remove-btn {
          width: 32px; height: 38px; border-radius: var(--r-sm);
          background: var(--surface-2); border: 1px solid var(--border);
          color: var(--text-3); cursor: pointer;
          display: flex; align-items: center; justify-content: center; transition: all 0.14s;
          margin-top: 0;
        }
        .remove-btn:hover:not(:disabled) { background: var(--red-dim); color: var(--red); }
        .remove-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        .other-hint {
          margin-top: 14px; font-size: 12px; color: var(--text-3);
          background: var(--surface-2); border-radius: var(--r-sm); padding: 10px 14px;
        }
        .entry-footer {
          display: flex; align-items: center; justify-content: space-between;
          margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);
        }
        .audit-notice { font-size: 11px; color: var(--text-3); }

        /* Today panel */
        .today-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid var(--border);
        }
        .today-total {
          font-family: var(--font-display); font-size: 18px;
          font-weight: 700; color: var(--brand);
        }
        .today-list { display: flex; flex-direction: column; gap: 6px; }
        .today-row {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px;
          background: var(--surface-2); border: 1px solid var(--border);
          border-radius: var(--r-sm);
        }
        .today-cat-icon {
          width: 26px; height: 26px; border-radius: var(--r-sm);
          background: var(--brand-glow); color: var(--brand);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .today-row-info { flex: 1; min-width: 0; }
        .today-cat-name { font-size: 13px; font-weight: 500; display: block; }
        .today-note { font-size: 11px; color: var(--text-3); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .today-amount { font-family: var(--font-display); font-weight: 700; font-size: 14px; color: var(--text); white-space: nowrap; }
        .delete-btn {
          width: 24px; height: 24px; border-radius: var(--r-sm);
          background: none; border: none; color: var(--text-3); cursor: pointer;
          display: flex; align-items: center; justify-content: center; transition: all 0.12s; flex-shrink: 0;
        }
        .delete-btn:hover { background: var(--red-dim); color: var(--red); }

        :global(.spin) { animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 1024px) {

  .expenses-layout {
    grid-template-columns: 1fr;
  }

  .today-card {
    width: 100%;
  }
}

@media (max-width: 768px) {

  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
  }

  .date-wrap {
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

  .cat-field,
  .amount-wrap {
    width: 100%;
  }

  .remove-btn {
    width: 100%;
    height: 40px;
  }

  .entry-footer {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .entry-footer .btn {
    width: 100%;
    justify-content: center;
  }

  .today-row {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .today-amount {
    margin-left: auto;
  }
}

@media (max-width: 520px) {

  .page-title {
    font-size: 20px;
  }

  .page-subtitle {
    font-size: 13px;
  }

  .today-total {
    font-size: 16px;
  }

  .today-row {
    padding: 10px;
  }

  .today-cat-name {
    font-size: 12px;
  }

  .today-note {
    white-space: normal;
  }

  .other-hint,
  .audit-notice {
    font-size: 11px;
    line-height: 1.5;
  }
}
      `}</style>
    </div>
  )
}