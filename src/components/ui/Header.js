'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import toast from 'react-hot-toast'
import Link from 'next/link'
import {
  Bell, LogOut, ChevronDown, CheckCheck,
  AlertTriangle, Info, Settings, User,
  Package, ShoppingCart, IndianRupee
} from 'lucide-react'

// Map notification types to icon + colour
function NotifIcon({ type }) {
  if (type === 'low_stock')    return <Package     size={13} color="var(--yellow)" />
  if (type === 'salary_due')   return <IndianRupee size={13} color="var(--red)"    />
  if (type === 'sale')         return <ShoppingCart size={13} color="var(--blue)"  />
  return                              <Info         size={13} color="var(--blue)"  />
}

export default function Header({ user }) {
  const router   = useRouter()
  const [notifications, setNotifications] = useState([])
  const [notifOpen, setNotifOpen]         = useState(false)
  const [userOpen, setUserOpen]           = useState(false)
  const [lowStockCount, setLowStockCount] = useState(0)
  const notifRef = useRef(null)
  const userRef  = useRef(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    fetchNotifications()
    fetchLowStock()

    // Real-time: new notification inserted → show toast + add to list
    const channel = supabase
      .channel('header-notifications')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
      }, payload => {
        setNotifications(prev => [payload.new, ...prev])
        toast(payload.new.title, {
          icon: payload.new.type === 'low_stock' ? '⚠️' : '🔔',
          duration: 5000,
        })
      })
      .subscribe()

    // Poll low stock every 60s
    const interval = setInterval(fetchLowStock, 60000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
      if (userRef.current  && !userRef.current.contains(e.target))  setUserOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function fetchNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifications(data || [])
  }

  async function fetchLowStock() {
    const { count } = await supabase
      .from('v_raw_material_stock')
      .select('*', { count: 'exact', head: true })
      .eq('is_low_stock', true)
    setLowStockCount(count || 0)
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false)
    setNotifications([])
    setNotifOpen(false)
    toast.success('All notifications cleared')
  }

  async function markOneRead(id) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('Logged out successfully')
    router.push('/login')
    router.refresh()
  }

  // Total badge = DB notifications + low stock items not yet in notifications
  const totalBadge = notifications.length + lowStockCount

  return (
    <header className="header">
      {/* Left — date */}
      <div className="header-date">
        {new Date().toLocaleDateString('en-IN', {
          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
        })}
      </div>

      {/* Right */}
      <div className="header-right">

        {/* ── Notification bell ── */}
        <div className="hd-dropdown" ref={notifRef}>
          <button
            className="icon-btn"
            onClick={() => { setNotifOpen(v => !v); setUserOpen(false) }}
            aria-label="Notifications"
          >
            <Bell size={17} />
            {totalBadge > 0 && (
              <span className="notif-badge">{totalBadge > 9 ? '9+' : totalBadge}</span>
            )}
          </button>

          {notifOpen && (
            <div className="dropdown notif-dropdown">
              <div className="dropdown-hdr">
                <span className="dropdown-ttl">Notifications</span>
                {notifications.length > 0 && (
                  <button className="mark-read-btn" onClick={markAllRead}>
                    <CheckCheck size={12} /> Mark all read
                  </button>
                )}
              </div>

              <div className="notif-scroll">
                {/* Low stock section */}
                {lowStockCount > 0 && (
                  <Link
                    href="/dashboard/raw-materials"
                    className="notif-row notif-warn"
                    onClick={() => setNotifOpen(false)}
                  >
                    <div className="notif-icon-wrap notif-icon-warn">
                      <AlertTriangle size={13} color="var(--yellow)" />
                    </div>
                    <div className="notif-body">
                      <div className="notif-ttl">Low Stock Alert</div>
                      <div className="notif-msg">
                        {lowStockCount} raw material{lowStockCount > 1 ? 's' : ''} below threshold — tap to view
                      </div>
                    </div>
                  </Link>
                )}

                {/* DB notifications */}
                {notifications.length === 0 && lowStockCount === 0 ? (
                  <div className="notif-empty">
                    <Bell size={24} />
                    <p>All caught up!</p>
                    <span>No unread notifications</span>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className={`notif-row ${n.type === 'low_stock' ? 'notif-warn' : 'notif-info'}`}
                      onClick={() => markOneRead(n.id)}
                    >
                      <div className={`notif-icon-wrap ${n.type === 'low_stock' ? 'notif-icon-warn' : 'notif-icon-info'}`}>
                        <NotifIcon type={n.type} />
                      </div>
                      <div className="notif-body">
                        <div className="notif-ttl">{n.title}</div>
                        <div className="notif-msg">{n.message}</div>
                        <div className="notif-time">
                          {new Date(n.created_at).toLocaleString('en-IN', {
                            day: 'numeric', month: 'short',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </div>
                      </div>
                      <button
                        className="notif-dismiss"
                        onClick={e => { e.stopPropagation(); markOneRead(n.id) }}
                        title="Dismiss"
                      >×</button>
                    </div>
                  ))
                )}
              </div>

              {/* Footer link */}
              {(notifications.length > 0 || lowStockCount > 0) && (
                <div className="notif-footer">
                  <Link href="/dashboard/raw-materials" className="notif-footer-link"
                    onClick={() => setNotifOpen(false)}>
                    View stock overview →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── User menu ── */}
        <div className="hd-dropdown" ref={userRef}>
          <button
            className="user-btn"
            onClick={() => { setUserOpen(v => !v); setNotifOpen(false) }}
          >
            <div className="user-avatar">
              {user?.full_name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="user-info">
              <span className="user-name">{user?.full_name || 'Admin'}</span>
              <span className="user-role">{user?.role || 'admin'}</span>
            </div>
            <ChevronDown size={13} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          </button>

          {userOpen && (
            <div className="dropdown user-dropdown">
              {/* User info block */}
              <div className="user-info-block">
                <div className="user-info-avatar">
                  {user?.full_name?.charAt(0)?.toUpperCase() || 'A'}
                </div>
                <div>
                  <div className="user-info-name">{user?.full_name || 'Admin'}</div>
                  <div className="user-info-role">{user?.role || 'admin'}</div>
                </div>
              </div>

              <div className="user-menu-divider" />

              {/* Menu items */}
              <Link
                href="/dashboard/settings"
                className="user-menu-item"
                onClick={() => setUserOpen(false)}
              >
                <div className="menu-item-icon menu-item-icon-settings">
                  <Settings size={13} />
                </div>
                <div>
                  <div className="menu-item-label">Settings</div>
                </div>
              </Link>

            
              <div className="user-menu-divider" />

              <button className="user-menu-item user-menu-logout" onClick={handleLogout}>
                <div className="menu-item-icon menu-item-icon-logout">
                  <LogOut size={13} />
                </div>
                <div>
                  <div className="menu-item-label">Sign out</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .header {
          position: sticky; top: 0; z-index: 30;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          padding: 0 32px; height: 60px;
          display: flex; align-items: center; justify-content: space-between;
        }

        .header-date { font-size: 13px; color: var(--text-2); }
        .header-right { display: flex; align-items: center; gap: 8px; }

        /* Icon button */
        .icon-btn {
          position: relative;
          width: 38px; height: 38px;
          border-radius: var(--r-md);
          background: var(--surface-2); border: 1px solid var(--border);
          color: var(--text-2); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .icon-btn:hover { background: var(--surface-3); color: var(--text); border-color: var(--border-2); }

        .notif-badge {
          position: absolute; top: 4px; right: 4px;
          min-width: 16px; height: 16px;
          background: var(--red); color: #fff;
          border-radius: 99px; font-size: 9px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          padding: 0 3px; border: 2px solid var(--surface);
        }

        /* Dropdown base */
        .hd-dropdown { position: relative; }
        .dropdown {
          position: absolute; top: calc(100% + 10px); right: 0;
          background: var(--surface); border: 1px solid var(--border-2);
          border-radius: var(--r-lg);
          box-shadow: 0 20px 50px rgba(0,0,0,0.45);
          z-index: 100; animation: fadeSlide 0.15s ease; overflow: hidden;
        }
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Notifications dropdown ── */
        .notif-dropdown { width: 340px; }

        .dropdown-hdr {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px 10px; border-bottom: 1px solid var(--border);
        }
        .dropdown-ttl {
          font-family: var(--font-display); font-size: 13px;
          font-weight: 700; color: var(--text);
        }
        .mark-read-btn {
          display: flex; align-items: center; gap: 5px;
          background: none; border: none; color: var(--brand);
          font-size: 11px; cursor: pointer; font-family: var(--font-body);
          padding: 4px 8px; border-radius: var(--r-sm);
          transition: background 0.12s;
        }
        .mark-read-btn:hover { background: var(--brand-glow); }

        .notif-scroll { max-height: 360px; overflow-y: auto; }

        .notif-empty {
          padding: 36px 20px; text-align: center; color: var(--text-3);
        }
        .notif-empty :global(svg) { margin: 0 auto 10px; opacity: 0.25; display: block; }
        .notif-empty p { font-size: 14px; font-weight: 600; color: var(--text-2); margin-bottom: 4px; }
        .notif-empty span { font-size: 12px; }

        .notif-row {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 12px 16px; cursor: pointer;
          border-bottom: 1px solid var(--border);
          transition: background 0.12s; text-decoration: none;
          position: relative;
        }
        .notif-row:last-child { border-bottom: none; }
        .notif-warn:hover { background: rgba(251,191,36,0.06); }
        .notif-info:hover { background: rgba(96,165,250,0.06); }

        .notif-icon-wrap {
          width: 30px; height: 30px; border-radius: var(--r-sm);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; margin-top: 1px;
        }
        .notif-icon-warn { background: var(--yellow-dim); }
        .notif-icon-info { background: var(--blue-dim); }

        .notif-body { flex: 1; min-width: 0; }
        .notif-ttl { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 3px; }
        .notif-msg { font-size: 12px; color: var(--text-2); line-height: 1.4; }
        .notif-time { font-size: 11px; color: var(--text-3); margin-top: 4px; }

        .notif-dismiss {
          position: absolute; top: 10px; right: 10px;
          width: 18px; height: 18px; border-radius: 50%;
          background: var(--surface-3); border: none;
          color: var(--text-3); cursor: pointer; font-size: 13px;
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity 0.15s;
        }
        .notif-row:hover .notif-dismiss { opacity: 1; }

        .notif-footer {
          padding: 10px 16px; border-top: 1px solid var(--border);
          background: var(--surface-2);
        }
        .notif-footer-link {
          font-size: 12px; color: var(--brand); text-decoration: none; font-weight: 500;
        }
        .notif-footer-link:hover { text-decoration: underline; }

        /* ── User dropdown ── */
        .user-btn {
          display: flex; align-items: center; gap: 9px;
          background: var(--surface-2); border: 1px solid var(--border);
          border-radius: var(--r-md); padding: 5px 10px 5px 5px;
          cursor: pointer; transition: all 0.15s; color: var(--text);
        }
        .user-btn:hover { background: var(--surface-3); border-color: var(--border-2); }

        .user-avatar {
          width: 28px; height: 28px; border-radius: var(--r-sm);
          background: var(--brand-glow); border: 1px solid rgba(249,115,22,0.3);
          color: var(--brand); font-family: var(--font-display);
          font-size: 13px; font-weight: 700;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .user-info { display: flex; flex-direction: column; align-items: flex-start; }
        .user-name { font-size: 13px; font-weight: 500; line-height: 1.2; color: var(--text); }
        .user-role { font-size: 10px; color: var(--text-3); text-transform: capitalize; }

        .user-dropdown { width: 240px; }

        .user-info-block {
          display: flex; align-items: center; gap: 12px;
          padding: 16px;
        }
        .user-info-avatar {
          width: 40px; height: 40px; border-radius: var(--r-md);
          background: var(--brand-glow); border: 1px solid rgba(249,115,22,0.3);
          color: var(--brand); font-family: var(--font-display);
          font-size: 18px; font-weight: 700;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .user-info-name { font-weight: 600; font-size: 14px; color: var(--text); }
        .user-info-role { font-size: 11px; color: var(--text-3); text-transform: capitalize; margin-top: 2px; }

        .user-menu-divider { height: 1px; background: var(--border); }

        .user-menu-item {
          display: flex; align-items: center; gap: 12px;
          width: 100%; padding: 11px 16px;
          background: none; border: none;
          font-family: var(--font-body); cursor: pointer;
          transition: background 0.12s; text-decoration: none;
          color: var(--text);
        }
        .user-menu-item:hover { background: var(--surface-2); }

        .menu-item-icon {
          width: 30px; height: 30px; border-radius: var(--r-sm);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .menu-item-icon-settings { background: var(--brand-glow);   color: var(--brand); }
        .menu-item-icon-masters  { background: var(--blue-dim);     color: var(--blue);  }
        .menu-item-icon-logout   { background: var(--red-dim);      color: var(--red);   }

        .menu-item-label { font-size: 13px; font-weight: 500; color: var(--text); }
        .menu-item-sub   { font-size: 11px; color: var(--text-3); margin-top: 1px; }

        .user-menu-logout .menu-item-label { color: var(--red); }
        .user-menu-logout:hover { background: var(--red-dim); }

        @media (max-width: 768px) {
          .header { padding: 0 16px 0 56px; }
          .user-info { display: none; }
        }
      `}</style>
    </header>
  )
}