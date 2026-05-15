'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  Users, Calendar, Save, Loader2,
  CheckCircle2, XCircle, Clock, Minus
} from 'lucide-react'

const STATUS_OPTIONS = [
  { value: 'present',  label: 'Present',  color: 'var(--green)',  icon: CheckCircle2 },
  { value: 'absent',   label: 'Absent',   color: 'var(--red)',    icon: XCircle },
  { value: 'half_day', label: 'Half Day', color: 'var(--yellow)', icon: Clock },
  { value: 'holiday',  label: 'Holiday',  color: 'var(--text-3)', icon: Minus },
]

export default function AttendancePage() {
  const [workers, setWorkers]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [date, setDate]             = useState(new Date().toISOString().split('T')[0])
  const [attendance, setAttendance] = useState({}) // { worker_id: { status, notes } }
  const [existingIds, setExistingIds] = useState({}) // { worker_id: attendance_record_id }

  useEffect(() => { fetchWorkers() }, [])
  useEffect(() => { if (workers.length > 0) fetchAttendance(date) }, [date, workers])

  async function fetchWorkers() {
    setLoading(true)
    const { data } = await supabase
      .from('workers')
      .select('id, name, role, salary_type, salary_amount')
      .eq('is_active', true)
      .order('name')
    setWorkers(data || [])
    setLoading(false)
  }

  async function fetchAttendance(forDate) {
    const { data } = await supabase
      .from('worker_attendance')
      .select('id, worker_id, status, notes')
      .eq('entry_date', forDate)

    // Build maps
    const attMap = {}
    const idMap  = {}
    workers.forEach(w => {
      attMap[w.id] = { status: 'present', notes: '' } // default present
    })
    ;(data || []).forEach(r => {
      attMap[r.worker_id] = { status: r.status, notes: r.notes || '' }
      idMap[r.worker_id]  = r.id
    })
    setAttendance(attMap)
    setExistingIds(idMap)
  }

  function setStatus(workerId, status) {
    setAttendance(prev => ({
      ...prev,
      [workerId]: { ...prev[workerId], status }
    }))
  }

  function setNotes(workerId, notes) {
    setAttendance(prev => ({
      ...prev,
      [workerId]: { ...prev[workerId], notes }
    }))
  }

  function markAll(status) {
    const updated = {}
    workers.forEach(w => {
      updated[w.id] = { status, notes: attendance[w.id]?.notes || '' }
    })
    setAttendance(updated)
  }

  async function handleSave() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    const records = workers.map(w => ({
      worker_id:  w.id,
      entry_date: date,
      status:     attendance[w.id]?.status || 'present',
      notes:      attendance[w.id]?.notes  || null,
      entered_by: user?.id,
      entered_at: new Date().toISOString(),
    }))

    // Upsert — if record exists for this worker+date, update it
    const { error } = await supabase
      .from('worker_attendance')
      .upsert(records, { onConflict: 'worker_id,entry_date' })

    if (error) {
      toast.error('Failed to save: ' + error.message)
    } else {
      toast.success(`Attendance saved for ${records.length} workers`)
      fetchAttendance(date)
    }
    setSaving(false)
  }

  // Counts
  const counts = { present: 0, absent: 0, half_day: 0, holiday: 0 }
  workers.forEach(w => {
    const s = attendance[w.id]?.status || 'present'
    counts[s] = (counts[s] || 0) + 1
  })

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Daily Attendance</div>
          <div className="page-subtitle">Mark attendance for all workers</div>
        </div>
        <div className="header-right">
          <div className="date-wrap">
            <Calendar size={14} className="date-icon" />
            <input type="date" className="input date-input"
              value={date}
              onChange={e => setDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]} />
          </div>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || loading}>
            {saving
              ? <><Loader2 size={14} className="spin" /> Saving…</>
              : <><Save size={14} /> Save Attendance</>
            }
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="summary-bar">
        {STATUS_OPTIONS.map(s => (
          <div key={s.value} className="summary-chip" style={{ borderColor: s.color + '44' }}>
            <s.icon size={14} color={s.color} />
            <span style={{ color: s.color, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>
              {counts[s.value] || 0}
            </span>
            <span className="text-faint">{s.label}</span>
          </div>
        ))}

        {/* Quick mark all */}
        <div className="mark-all-btns">
          <span className="text-faint" style={{ fontSize: 12 }}>Mark all:</span>
          <button className="btn btn-ghost btn-sm" onClick={() => markAll('present')}>
            <CheckCircle2 size={12} color="var(--green)" /> Present
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => markAll('absent')}>
            <XCircle size={12} color="var(--red)" /> Absent
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => markAll('holiday')}>
            <Minus size={12} /> Holiday
          </button>
        </div>
      </div>

      {/* Worker list */}
      {loading ? (
        <div className="loading-state"><Loader2 size={22} className="spin" /> Loading workers…</div>
      ) : workers.length === 0 ? (
        <div className="empty-state card">
          <Users size={32} />
          <p>No active workers. Add workers in Worker Master first.</p>
        </div>
      ) : (
        <div className="workers-attendance-list">
          {workers.map((w, i) => {
            const att     = attendance[w.id] || { status: 'present', notes: '' }
            const current = STATUS_OPTIONS.find(s => s.value === att.status)
            return (
              <div key={w.id} className={`worker-att-row att-${att.status}`}>
                {/* Worker info */}
                <div className="worker-info">
                  <div className="worker-num">{i + 1}</div>
                  <div className="worker-avatar">
                    {w.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="worker-name">{w.name}</div>
                    <div className="worker-meta">
                      {w.role && <span className="badge badge-blue" style={{ fontSize: 10 }}>{w.role}</span>}
                      <span className="text-faint" style={{ fontSize: 11 }}>
                        {w.salary_type === 'fixed'
                          ? `₹${parseFloat(w.salary_amount).toLocaleString('en-IN')}/mo`
                          : `₹${parseFloat(w.salary_amount).toLocaleString('en-IN')}/day`
                        }
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status buttons */}
                <div className="status-btns">
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      className={`status-btn ${att.status === opt.value ? 'status-btn-active' : ''}`}
                      style={att.status === opt.value ? {
                        background:   opt.color + '18',
                        borderColor:  opt.color + '55',
                        color:        opt.color,
                      } : {}}
                      onClick={() => setStatus(w.id, opt.value)}
                    >
                      <opt.icon size={13} />
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Notes */}
                <div className="att-notes">
                  <input
                    className="input"
                    style={{ fontSize: 12, padding: '7px 12px' }}
                    placeholder="Note (optional)…"
                    value={att.notes}
                    onChange={e => setNotes(w.id, e.target.value)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Bottom save */}
      {workers.length > 0 && (
        <div className="bottom-save">
          <div className="audit-note">
            Attendance will be saved with your user ID, timestamp and IP address.
          </div>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving
              ? <><Loader2 size={14} className="spin" /> Saving…</>
              : <><Save size={14} /> Save All Attendance</>
            }
          </button>
        </div>
      )}

      <style jsx>{`
        .header-right { display: flex; align-items: center; gap: 12px; }
        .date-wrap { position: relative; }
        .date-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-3); pointer-events: none; }
        .date-input { padding-left: 36px; width: 180px; }

        .summary-bar {
          display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); padding: 16px 20px; margin-bottom: 20px;
        }
        .summary-chip {
          display: flex; align-items: center; gap: 8px;
          background: var(--surface-2); border: 1px solid;
          border-radius: var(--r-md); padding: 10px 16px;
        }
        .mark-all-btns {
          display: flex; align-items: center; gap: 8px;
          margin-left: auto; flex-wrap: wrap;
        }

        .loading-state {
          display: flex; align-items: center; justify-content: center;
          gap: 12px; padding: 60px; color: var(--text-3);
        }

        .workers-attendance-list { display: flex; flex-direction: column; gap: 8px; }

        .worker-att-row {
          display: grid;
          grid-template-columns: 1fr auto 200px;
          gap: 16px; align-items: center;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-md); padding: 14px 18px;
          transition: border-color 0.14s;
        }
        .att-present  { border-left: 3px solid var(--green); }
        .att-absent   { border-left: 3px solid var(--red); }
        .att-half_day { border-left: 3px solid var(--yellow); }
        .att-holiday  { border-left: 3px solid var(--text-3); }

        .worker-info { display: flex; align-items: center; gap: 12px; }
        .worker-num { font-size: 12px; color: var(--text-3); width: 20px; text-align: center; flex-shrink: 0; }
        .worker-avatar {
          width: 36px; height: 36px; border-radius: var(--r-sm);
          background: var(--brand-glow); border: 1px solid rgba(249,115,22,0.2);
          color: var(--brand); font-family: var(--font-display);
          font-size: 15px; font-weight: 700;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .worker-name { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
        .worker-meta { display: flex; align-items: center; gap: 6px; }

        .status-btns { display: flex; gap: 6px; flex-wrap: wrap; }
        .status-btn {
          display: flex; align-items: center; gap: 5px;
          padding: 6px 12px; border-radius: var(--r-sm);
          background: var(--surface-2); border: 1px solid var(--border);
          color: var(--text-2); font-size: 12.5px; font-family: var(--font-body);
          cursor: pointer; transition: all 0.14s; white-space: nowrap;
        }
        .status-btn:hover { background: var(--surface-3); color: var(--text); }
        .status-btn-active { font-weight: 600; }

        .att-notes { }

        .bottom-save {
          display: flex; align-items: center; justify-content: space-between;
          margin-top: 20px; padding: 16px 20px;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg);
        }
        .audit-note { font-size: 12px; color: var(--text-3); }

        :global(.spin) { animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 1024px) {

  .worker-att-row {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .att-notes {
    width: 100%;
  }

  .att-notes .input {
    width: 100%;
  }
}

@media (max-width: 768px) {

  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
  }

  .header-right {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .date-wrap {
    width: 100%;
  }

  .date-input {
    width: 100%;
  }

  .header-right .btn {
    width: 100%;
    justify-content: center;
  }

  .summary-bar {
    padding: 14px;
    gap: 10px;
  }

  .summary-chip {
    width: calc(50% - 5px);
    justify-content: center;
  }

  .mark-all-btns {
    width: 100%;
    margin-left: 0;
  }

  .mark-all-btns .btn {
    flex: 1;
    justify-content: center;
  }

  .worker-att-row {
    padding: 14px;
  }

  .worker-info {
    align-items: flex-start;
  }

  .status-btns {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .status-btn {
    justify-content: center;
  }

  .bottom-save {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .bottom-save .btn {
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

  .summary-chip {
    width: 100%;
  }

  .worker-meta {
    flex-wrap: wrap;
  }

  .status-btns {
    grid-template-columns: 1fr;
  }

  .worker-name {
    font-size: 13px;
  }

  .audit-note {
    font-size: 11px;
    line-height: 1.5;
  }
}
      `}</style>
    </div>
  )
}