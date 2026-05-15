'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import {
  User, Lock, Save, Loader2, Eye, EyeOff,
  Shield, Bell, Milk, CheckCircle2, X, LogOut
} from 'lucide-react'

export default function SettingsPage() {
  const [profile, setProfile]       = useState(null)
  const [loading, setLoading]       = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [activeTab, setActiveTab]   = useState('profile')
  const router = useRouter()

  // Profile form
  const [fullName, setFullName]     = useState('')

  // Password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent]         = useState(false)
  const [showNew, setShowNew]                 = useState(false)
  const [showConfirm, setShowConfirm]         = useState(false)

  // App info
  const [appStats, setAppStats] = useState({})

  useEffect(() => {
    fetchProfile()
    fetchAppStats()
  }, [])

  async function fetchProfile() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    setProfile({ ...prof, email: user.email })
    setFullName(prof?.full_name || '')
    setLoading(false)
  }

  async function fetchAppStats() {
    const today = new Date().toISOString().split('T')[0]
    const [
      { count: products },
      { count: distributors },
      { count: workers },
      { count: rawMaterials },
      { count: totalProduction },
      { count: totalSales },
    ] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('distributors').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('workers').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('raw_materials').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('daily_production').select('*', { count: 'exact', head: true }),
      supabase.from('daily_sales').select('*', { count: 'exact', head: true }),
    ])
    setAppStats({ products, distributors, workers, rawMaterials, totalProduction, totalSales })
  }

  async function handleSaveProfile(e) {
    e.preventDefault()
    if (!fullName.trim()) { toast.error('Name cannot be empty'); return }
    setSavingProfile(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() })
      .eq('id', user.id)

    if (error) toast.error('Failed to update profile')
    else { toast.success('Profile updated'); fetchProfile() }
    setSavingProfile(false)
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    if (newPassword.length < 6) { toast.error('New password must be at least 6 characters'); return }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return }

    setSavingPassword(true)

    // Re-authenticate first with current password
    const { data: { user } } = await supabase.auth.getUser()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email:    profile.email,
      password: currentPassword,
    })

    if (signInError) {
      toast.error('Current password is incorrect')
      setSavingPassword(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) toast.error('Failed to change password: ' + error.message)
    else {
      toast.success('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
    setSavingPassword(false)
  }

  async function handleLogout() {
  await supabase.auth.signOut()
  toast.success('Signed out')
  router.push('/login')
  router.refresh()
}

  const TABS = [
    { key: 'profile',  label: 'Profile',  icon: User   },
    { key: 'security', label: 'Security', icon: Lock   },
    { key: 'system',   label: 'System',   icon: Shield },
  ]

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, color: 'var(--text-3)', gap: 12 }}>
        <Loader2 size={22} className="spin" /> Loading settings…
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">Manage your profile, security and system info</div>
        </div>
      </div>

      <div className="settings-layout">
        {/* Sidebar tabs */}
        <div className="settings-nav card" style={{ padding: 8 }}>
          {TABS.map(t => (
            <button
              key={t.key}
              className={`settings-tab ${activeTab === t.key ? 'settings-tab-active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              <t.icon size={15} strokeWidth={1.8} />
              {t.label}
            </button>
          ))}

          {/* User info at bottom */}
          <div className="settings-user-info">
            <div className="settings-avatar">
              {profile?.full_name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{profile?.full_name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{profile?.role}</div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="settings-content">

          {/* ── PROFILE TAB ── */}
          {activeTab === 'profile' && (
            <div className="card">
              <div className="settings-section-header">
                <User size={16} color="var(--brand)" />
                <div>
                  <div className="settings-section-title">Profile Information</div>
                  <div className="settings-section-sub">Update your display name</div>
                </div>
              </div>

              <form onSubmit={handleSaveProfile}>
                <div className="form-group">
                  <label className="label">Full Name</label>
                  <input
                    className="input"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Your full name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="label">Email Address</label>
                  <input
                    className="input"
                    value={profile?.email || ''}
                    disabled
                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5 }}>
                    Email cannot be changed. Contact your system administrator.
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Role</label>
                  <div className="role-display">
                    <Shield size={14} color="var(--brand)" />
                    <span style={{ fontWeight: 600, color: 'var(--brand)', textTransform: 'capitalize' }}>
                      {profile?.role}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      — Full access to all modules
                    </span>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                  {savingProfile
                    ? <><Loader2 size={14} className="spin" /> Saving…</>
                    : <><Save size={14} /> Save Profile</>
                  }
                </button>
                <button
                  type="button"
                  className="btn btn-ghost logout-btn"
                  onClick={handleLogout}
                >
                  <LogOut size={14} />
                  Sign Out
                </button>
              </form>
            </div>
          )}

          {/* ── SECURITY TAB ── */}
          {activeTab === 'security' && (
            <div className="card">
              <div className="settings-section-header">
                <Lock size={16} color="var(--blue)" />
                <div>
                  <div className="settings-section-title">Change Password</div>
                  <div className="settings-section-sub">Use a strong password of at least 6 characters</div>
                </div>
              </div>

              <form onSubmit={handleChangePassword}>
                <div className="form-group">
                  <label className="label">Current Password</label>
                  <div className="pw-wrap">
                    <input
                      className="input pw-input"
                      type={showCurrent ? 'text' : 'password'}
                      placeholder="Enter current password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      required
                    />
                    <button type="button" className="pw-eye" onClick={() => setShowCurrent(v => !v)}>
                      {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">New Password</label>
                  <div className="pw-wrap">
                    <input
                      className="input pw-input"
                      type={showNew ? 'text' : 'password'}
                      placeholder="Enter new password (min 6 chars)"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                    />
                    <button type="button" className="pw-eye" onClick={() => setShowNew(v => !v)}>
                      {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Confirm New Password</label>
                  <div className="pw-wrap">
                    <input
                      className="input pw-input"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Repeat new password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                    />
                    <button type="button" className="pw-eye" onClick={() => setShowConfirm(v => !v)}>
                      {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {/* Match indicator */}
                  {confirmPassword.length > 0 && (
                    <div className={`pw-match ${newPassword === confirmPassword ? 'pw-match-ok' : 'pw-match-err'}`}>
                      {newPassword === confirmPassword
                        ? <><CheckCircle2 size={12} /> Passwords match</>
                        : <><X size={12} /> Passwords do not match</>
                      }
                    </div>
                  )}
                </div>

                {/* Password strength */}
                {newPassword.length > 0 && (
                  <div className="pw-strength">
                    <div className="pw-strength-label">Strength</div>
                    <div className="pw-strength-bar">
                      {[1, 2, 3, 4].map(lvl => {
                        const strength =
                          newPassword.length >= 12 && /[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword) && /[^a-zA-Z0-9]/.test(newPassword) ? 4 :
                          newPassword.length >= 8  && /[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword) ? 3 :
                          newPassword.length >= 6  ? 2 : 1
                        const colors = ['', 'var(--red)', 'var(--yellow)', 'var(--blue)', 'var(--green)']
                        return (
                          <div key={lvl} className="pw-bar-seg"
                            style={{ background: lvl <= strength ? colors[strength] : 'var(--surface-3)' }} />
                        )
                      })}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {newPassword.length < 6 ? 'Too short' : newPassword.length < 8 ? 'Weak' : newPassword.length < 12 ? 'Good' : 'Strong'}
                    </span>
                  </div>
                )}

                <button type="submit" className="btn btn-primary" disabled={savingPassword}>
                  {savingPassword
                    ? <><Loader2 size={14} className="spin" /> Changing…</>
                    : <><Lock size={14} /> Change Password</>
                  }
                </button>
              </form>

              {/* Security info */}
              <div className="security-info">
                <div className="security-info-title">Security Notes</div>
                <ul>
                  <li>All sensitive entries are logged with your user ID, timestamp and IP address.</li>
                  <li>Session expires automatically when browser is closed.</li>
                  <li>Do not share your login credentials with anyone.</li>
                </ul>
              </div>
            </div>
          )}

          {/* ── SYSTEM TAB ── */}
          {activeTab === 'system' && (
            <div className="card">
              <div className="settings-section-header">
                <Milk size={16} color="var(--brand)" />
                <div>
                  <div className="settings-section-title">System Information</div>
                  <div className="settings-section-sub">Dairy ERP — internal management system</div>
                </div>
              </div>

              {/* App stats */}
              <div className="sys-stats-grid">
                {[
                  { label: 'Active Products',     value: appStats.products      || 0 },
                  { label: 'Active Distributors', value: appStats.distributors  || 0 },
                  { label: 'Active Workers',       value: appStats.workers       || 0 },
                  { label: 'Raw Materials',        value: appStats.rawMaterials  || 0 },
                  { label: 'Production Entries',   value: appStats.totalProduction || 0 },
                  { label: 'Sale Bills',           value: appStats.totalSales    || 0 },
                ].map(s => (
                  <div key={s.label} className="sys-stat-card">
                    <div className="sys-stat-val">{s.value}</div>
                    <div className="sys-stat-label">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="divider" />

              {/* Version info */}
              <div className="version-info">
                <div className="version-row">
                  <span className="text-faint">System</span>
                  <span>Dairy ERP v1.0</span>
                </div>
               
                <div className="version-row">
                  <span className="text-faint">Logged in as</span>
                  <span style={{ color: 'var(--brand)', fontWeight: 600 }}>{profile?.full_name} ({profile?.role})</span>
                </div>
              </div>

              <div className="divider" />

              {/* Modules checklist */}
              <div className="modules-list">
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Installed Modules</div>
                {[
                  'Product Master', 'Distributor Master + Prices', 'Worker Master',
                  'Raw Material Master + Formula', 'Partner Master', 'Vehicle Master',
                  'Daily Production Entry', 'Daily Sales + WhatsApp Bill',
                  'Worker Attendance', 'Salary Payments + WhatsApp Receipt',
                  'Daily Expenses (auto-master)', 'Raw Material Stock Entry',
                  'Vehicle Expenses (route-based)', 'Partner Transactions + Loans',
                  'Dashboard with Charts', 'Date-range Reports + CSV Export',
                  'Low-stock Notifications', 'Audit Trail (IP + user + timestamp)',
                ].map(m => (
                  <div key={m} className="module-item">
                    <CheckCircle2 size={13} color="var(--green)" />
                    <span>{m}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      <style jsx>{`
        .settings-layout {
          display: grid;
          grid-template-columns: 200px 1fr;
          gap: 20px;
          align-items: start;
        }
        /* Logout button */
        .logout-btn {
            color: var(--red);
            border-color: rgba(248, 113, 113, 0.2);
          }

          .logout-btn:hover {
            background: var(--red-dim);
            color: var(--red);
          }

        /* Nav */
        .settings-nav { display: flex; flex-direction: column; gap: 2px; }
        .settings-tab {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: var(--r-md);
          background: none; border: none;
          color: var(--text-2); font-size: 13.5px;
          font-family: var(--font-body); cursor: pointer;
          transition: all 0.14s; text-align: left; width: 100%;
        }
        .settings-tab:hover { background: var(--surface-2); color: var(--text); }
        .settings-tab-active { background: var(--brand-glow); color: var(--brand); font-weight: 500; }

        .settings-user-info {
          display: flex; align-items: center; gap: 10px;
          margin-top: auto; padding: 14px 8px 6px;
          border-top: 1px solid var(--border);
          margin-top: 16px;
        }
        .settings-avatar {
          width: 32px; height: 32px; border-radius: var(--r-sm);
          background: var(--brand-glow); border: 1px solid rgba(249,115,22,0.25);
          color: var(--brand); font-family: var(--font-display);
          font-size: 14px; font-weight: 700;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }

        /* Section header */
        .settings-section-header {
          display: flex; align-items: flex-start; gap: 12px;
          padding-bottom: 20px; margin-bottom: 20px;
          border-bottom: 1px solid var(--border);
        }
        .settings-section-title { font-family: var(--font-display); font-weight: 700; font-size: 16px; }
        .settings-section-sub { font-size: 12px; color: var(--text-2); margin-top: 3px; }

        /* Role display */
        .role-display {
          display: flex; align-items: center; gap: 8px;
          background: var(--brand-glow); border: 1px solid rgba(249,115,22,0.2);
          border-radius: var(--r-md); padding: 10px 14px;
        }

        /* Password */
        .pw-wrap { position: relative; }
        .pw-input { padding-right: 42px; }
        .pw-eye {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          background: none; border: none; color: var(--text-3); cursor: pointer;
          display: flex; align-items: center; transition: color 0.14s;
        }
        .pw-eye:hover { color: var(--text-2); }
        .pw-match {
          display: flex; align-items: center; gap: 5px;
          margin-top: 6px; font-size: 12px; padding: 6px 10px;
          border-radius: var(--r-sm);
        }
        .pw-match-ok  { color: var(--green);  background: var(--green-dim);  }
        .pw-match-err { color: var(--red);    background: var(--red-dim);    }
        .pw-strength { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
        .pw-strength-label { font-size: 11px; color: var(--text-3); }
        .pw-strength-bar { display: flex; gap: 4px; }
        .pw-bar-seg { width: 36px; height: 5px; border-radius: 99px; transition: background 0.2s; }

        /* Security info */
        .security-info {
          margin-top: 20px; padding: 16px;
          background: var(--surface-2); border: 1px solid var(--border);
          border-radius: var(--r-md);
        }
        .security-info-title { font-weight: 600; font-size: 13px; margin-bottom: 8px; }
        .security-info ul { list-style: none; display: flex; flex-direction: column; gap: 6px; }
        .security-info li { font-size: 12.5px; color: var(--text-2); padding-left: 14px; position: relative; }
        .security-info li::before { content: '•'; position: absolute; left: 0; color: var(--brand); }

        /* System stats */
        .sys-stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 4px; }
        .sys-stat-card {
          background: var(--surface-2); border: 1px solid var(--border);
          border-radius: var(--r-md); padding: 14px; text-align: center;
        }
        .sys-stat-val { font-family: var(--font-display); font-size: 24px; font-weight: 700; color: var(--brand); }
        .sys-stat-label { font-size: 11px; color: var(--text-3); margin-top: 4px; }

        /* Version info */
        .version-info { display: flex; flex-direction: column; gap: 10px; }
        .version-row { display: flex; justify-content: space-between; font-size: 13px; }

        /* Modules */
        .modules-list { }
        .module-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-2); padding: 4px 0; }

        :global(.spin) { animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .settings-layout { grid-template-columns: 1fr; }
          .settings-nav { flex-direction: row; flex-wrap: wrap; }
          .settings-tab { flex: 1; justify-content: center; }
          .settings-user-info { display: none; }
          .sys-stats-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </div>
  )
}