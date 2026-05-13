'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import toast from 'react-hot-toast'
import { Bell, LogOut, User, ChevronDown, CheckCheck } from 'lucide-react'

export default function Header({ user }) {
  const router = useRouter()
  const [notifications, setNotifications] = useState([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const notifRef = useRef(null)
  const userRef = useRef(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    fetchNotifications()

    // Real-time subscription for notifications
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
      }, payload => {
        setNotifications(prev => [payload.new, ...prev])
        toast.error(payload.new.title, { duration: 5000 })
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
      if (userRef.current && !userRef.current.contains(e.target))   setUserOpen(false)
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

  async function markAllRead() {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false)
    setNotifications([])
    setNotifOpen(false)
  }

  async function markOneRead(id) {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('Logged out')
    router.push('/login')
    router.refresh()
  }

  const unread = notifications.length

  return (
    <header className="header">
      <div className="header-left">
        {/* Today's date */}
        <div className="header-date">
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'short', day: 'numeric',
            month: 'short', year: 'numeric',
          })}
        </div>
      </div>

      <div className="header-right">
        {/* Notifications */}
        <div className="header-dropdown" ref={notifRef}>
          <button
            className="header-icon-btn"
            onClick={() => { setNotifOpen(v => !v); setUserOpen(false) }}
            aria-label="Notifications"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>
            )}
          </button>

          {notifOpen && (
            <div className="dropdown-panel notif-panel">
              <div className="dropdown-header">
                <span className="dropdown-title">Notifications</span>
                {unread > 0 && (
                  <button className="mark-all-btn" onClick={markAllRead}>
                    <CheckCheck size={13} />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="notif-list">
                {notifications.length === 0 ? (
                  <div className="notif-empty">
                    <Bell size={22} />
                    <p>All caught up!</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className={`notif-item notif-${n.type === 'low_stock' ? 'warn' : 'info'}`}
                      onClick={() => markOneRead(n.id)}
                    >
                      <div className="notif-dot" />
                      <div>
                        <div className="notif-title">{n.title}</div>
                        <div className="notif-msg">{n.message}</div>
                        <div className="notif-time">
                          {new Date(n.created_at).toLocaleTimeString('en-IN', {
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="header-dropdown" ref={userRef}>
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
            <ChevronDown size={14} className="user-chevron" />
          </button>

          {userOpen && (
            <div className="dropdown-panel user-panel">
              <div className="dropdown-header">
                <span className="dropdown-title">Account</span>
              </div>
              <div className="user-panel-name">{user?.full_name}</div>
              <div className="user-panel-role">{user?.role}</div>
              <div className="divider" style={{ margin: '10px 0' }} />
              <button className="user-menu-item" onClick={handleLogout}>
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .header {
          position: sticky;
          top: 0;
          z-index: 30;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          padding: 0 32px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .header-date {
          font-size: 13px;
          color: var(--text-2);
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Icon button */
        .header-icon-btn {
          position: relative;
          width: 38px; height: 38px;
          border-radius: var(--r-md);
          background: var(--surface-2);
          border: 1px solid var(--border);
          color: var(--text-2);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .header-icon-btn:hover {
          background: var(--surface-3);
          color: var(--text);
          border-color: var(--border-2);
        }

        .notif-badge {
          position: absolute;
          top: 4px; right: 4px;
          min-width: 16px; height: 16px;
          background: var(--red);
          color: #fff;
          border-radius: 99px;
          font-size: 9px;
          font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          padding: 0 3px;
          border: 2px solid var(--surface);
        }

        /* Dropdown */
        .header-dropdown { position: relative; }

        .dropdown-panel {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          background: var(--surface);
          border: 1px solid var(--border-2);
          border-radius: var(--r-lg);
          box-shadow: 0 16px 40px rgba(0,0,0,0.4);
          z-index: 100;
          animation: slideUp 0.15s ease;
          overflow: hidden;
        }

        .dropdown-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px 10px;
          border-bottom: 1px solid var(--border);
        }
        .dropdown-title {
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
        }
        .mark-all-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          background: none;
          border: none;
          color: var(--brand);
          font-size: 11px;
          cursor: pointer;
          font-family: var(--font-body);
        }

        /* Notifications panel */
        .notif-panel { width: 320px; }

        .notif-list { max-height: 340px; overflow-y: auto; }

        .notif-empty {
          padding: 32px;
          text-align: center;
          color: var(--text-3);
          font-size: 13px;
        }
        .notif-empty :global(svg) {
          margin: 0 auto 8px;
          opacity: 0.3;
          display: block;
        }

        .notif-item {
          display: flex;
          gap: 12px;
          padding: 12px 16px;
          cursor: pointer;
          border-bottom: 1px solid var(--border);
          transition: background 0.12s;
        }
        .notif-item:last-child { border-bottom: none; }
        .notif-item:hover { background: var(--surface-2); }

        .notif-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          margin-top: 5px;
          flex-shrink: 0;
        }
        .notif-warn .notif-dot { background: var(--yellow); }
        .notif-info .notif-dot { background: var(--blue); }

        .notif-title {
          font-size: 13px;
          font-weight: 500;
          color: var(--text);
          margin-bottom: 2px;
        }
        .notif-msg {
          font-size: 12px;
          color: var(--text-2);
          line-height: 1.4;
        }
        .notif-time {
          font-size: 11px;
          color: var(--text-3);
          margin-top: 4px;
        }

        /* User button */
        .user-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          padding: 5px 12px 5px 6px;
          cursor: pointer;
          transition: all 0.15s;
          color: var(--text);
        }
        .user-btn:hover {
          background: var(--surface-3);
          border-color: var(--border-2);
        }

        .user-avatar {
          width: 28px; height: 28px;
          border-radius: var(--r-sm);
          background: var(--brand-glow);
          border: 1px solid rgba(249,115,22,0.3);
          color: var(--brand);
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .user-info {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        .user-name {
          font-size: 13px;
          font-weight: 500;
          line-height: 1.2;
          color: var(--text);
        }
        .user-role {
          font-size: 10px;
          color: var(--text-3);
          text-transform: capitalize;
        }
        .user-chevron { color: var(--text-3); }

        /* User panel */
        .user-panel { width: 200px; }

        .user-panel-name {
          padding: 12px 16px 2px;
          font-size: 14px;
          font-weight: 500;
          color: var(--text);
        }
        .user-panel-role {
          padding: 0 16px 10px;
          font-size: 11px;
          color: var(--text-3);
          text-transform: capitalize;
        }
        .user-menu-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 16px;
          background: none;
          border: none;
          color: var(--red);
          font-size: 13px;
          cursor: pointer;
          font-family: var(--font-body);
          transition: background 0.12s;
        }
        .user-menu-item:hover { background: var(--red-dim); }

        @media (max-width: 768px) {
          .header { padding: 0 16px 0 56px; }
          .user-info { display: none; }
          .user-chevron { display: none; }
        }
      `}</style>
    </header>
  )
}