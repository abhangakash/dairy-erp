'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import toast from 'react-hot-toast'
import Image from "next/image";
import {
  Milk, LayoutDashboard, FlaskConical, ShoppingCart,
  Users, Receipt, Package, Truck, HandCoins,
  FileBarChart2, Settings, Database, Bell,
  LogOut, ChevronDown, ChevronRight, X,
  Menu, AlertTriangle, CheckCheck, IndianRupee
} from 'lucide-react'

// ── Nav structure ─────────────────────────────────────────────
const NAV = [
  { label: 'Dashboard',      href: '/dashboard',                        icon: LayoutDashboard },
  { label: 'Production',     icon: FlaskConical, children: [
    { label: 'Daily Entry',  href: '/dashboard/production' },
    { label: 'History',      href: '/dashboard/production/history' },
  ]},
  { label: 'Sales', icon: ShoppingCart, children: [
    { label: 'Daily Entry',      href: '/dashboard/sales' },
    { label: 'History',          href: '/dashboard/sales/history' },
    { label: 'Collect Payment',  href: '/dashboard/sales/payments' },
    { label: 'Return',  href: '/dashboard/sales/return' },
    { label: 'Return History',  href: '/dashboard/sales/return/history' },
  ]},
  
  { label: 'Workers',        icon: Users, children: [
    { label: 'Attendance',   href: '/dashboard/workers/attendance' },
    { label: 'Salary',       href: '/dashboard/workers/salary' },
  ]},
  { label: 'Expenses',       href: '/dashboard/expenses',                icon: Receipt },
  { label: 'Raw Materials',  icon: Package, children: [
    { label: 'Stock',        href: '/dashboard/raw-materials' },
    { label: 'Stock Entry',  href: '/dashboard/raw-materials/entry' },
  ]},
  { label: 'Vehicles',       href: '/dashboard/vehicles',                icon: Truck },
  { label: 'Partners',       href: '/dashboard/partners',                icon: HandCoins },
  { label: 'Reports',        href: '/dashboard/reports',                 icon: FileBarChart2 },
]

const MASTERS = [
  { label: 'Products',       href: '/dashboard/masters/products' },
  { label: 'Distributors',   href: '/dashboard/masters/distributors' },
  { label: 'Workers',        href: '/dashboard/masters/workers' },
  { label: 'Raw Materials',  href: '/dashboard/masters/raw-materials' },
  { label: 'Partners',       href: '/dashboard/masters/partners' },
  { label: 'Vehicles',       href: '/dashboard/masters/vehicles' },
]

// ── Get page title from path ──────────────────────────────────
function getPageTitle(pathname) {
//   if (pathname === '/dashboard')                           return 'Dashboard'
//   if (pathname === '/dashboard/production')                return 'Production Entry'
//   if (pathname === '/dashboard/production/history')        return 'Production History'
//   if (pathname === '/dashboard/sales')                     return 'Sales Entry'
//   if (pathname === '/dashboard/sales/history')             return 'Sales History'
//   if (pathname === '/dashboard/workers/attendance')        return 'Attendance'
//   if (pathname === '/dashboard/workers/salary')            return 'Salary'
//   if (pathname === '/dashboard/expenses')                  return 'Daily Expenses'
//   if (pathname === '/dashboard/raw-materials')             return 'Raw Materials'
//   if (pathname === '/dashboard/raw-materials/entry')       return 'Stock Entry'
//   if (pathname === '/dashboard/vehicles')                  return 'Vehicles'
//   if (pathname === '/dashboard/partners')                  return 'Partners'
//   if (pathname === '/dashboard/reports')                   return 'Reports'
//   if (pathname === '/dashboard/settings')                  return 'Settings'
//   if (pathname?.includes('/masters/products'))             return 'Product Master'
//   if (pathname?.includes('/masters/distributors'))         return 'Distributor Master'
//   if (pathname?.includes('/masters/workers'))              return 'Worker Master'
//   if (pathname?.includes('/masters/raw-materials'))        return 'Raw Material Master'
//   if (pathname?.includes('/masters/partners'))             return 'Partner Master'
//   if (pathname?.includes('/masters/vehicles'))             return 'Vehicle Master'
  return 'Milky Feast'
}

// ── Single nav item ───────────────────────────────────────────
function NavItem({ item, pathname, onNavigate }) {
  const isActive = item.href
    ? pathname === item.href
    : item.children?.some(c => pathname === c.href)
  const [open, setOpen] = useState(isActive)

  if (item.children) {
    return (
      <div>
        <button
          className={`nav-btn ${isActive ? 'nav-active' : ''}`}
          onClick={() => setOpen(v => !v)}
        >
          <item.icon size={16} strokeWidth={1.8} />
          <span className="nav-label">{item.label}</span>
          <span className="nav-chevron">
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        </button>
        {open && (
          <div className="nav-children">
            {item.children.map(c => (
              <Link key={c.href} href={c.href}
                className={`nav-child-link ${pathname === c.href ? 'nav-active' : ''}`}
                onClick={onNavigate}>
                <span className="child-dot" />
                {c.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Link href={item.href}
      className={`nav-btn ${pathname === item.href ? 'nav-active' : ''}`}
      onClick={onNavigate}>
      <item.icon size={16} strokeWidth={1.8} />
      <span className="nav-label">{item.label}</span>
    </Link>
  )
}

// ── Main AppShell export ──────────────────────────────────────
export default function AppShell({ user, children }) {
  const router   = useRouter()
  const pathname = usePathname()

  const [drawerOpen, setDrawerOpen]       = useState(false)
  const [notifOpen, setNotifOpen]         = useState(false)
  const [mastersOpen, setMastersOpen]     = useState(pathname?.includes('/masters'))
  const [notifications, setNotifications] = useState([])
  const [lowStockCount, setLowStockCount] = useState(0)
  const notifRef = useRef(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    fetchNotifications()
    fetchLowStock()
    const channel = supabase.channel('notif-shell')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, p => {
        setNotifications(prev => [p.new, ...prev])
        toast(p.new.title, { icon: '🔔', duration: 5000 })
      })
      .subscribe()
    const interval = setInterval(fetchLowStock, 60000)
    return () => { supabase.removeChannel(channel); clearInterval(interval) }
  }, [])

  // Close notif on outside click
  useEffect(() => {
    function handler(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false) }, [pathname])

  async function fetchNotifications() {
    const { data } = await supabase.from('notifications').select('*')
      .eq('is_read', false).order('created_at', { ascending: false }).limit(15)
    setNotifications(data || [])
  }

  async function fetchLowStock() {
    const { count } = await supabase.from('v_raw_material_stock')
      .select('*', { count: 'exact', head: true }).eq('is_low_stock', true)
    setLowStockCount(count || 0)
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false)
    setNotifications([])
    toast.success('All cleared')
  }

  async function markOne(id) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/login')
    router.refresh()
  }

  const totalBadge  = notifications.length + lowStockCount
  const pageTitle   = getPageTitle(pathname)

  // ── Sidebar content (shared between desktop + mobile drawer) ─
  const SidebarContent = () => (
    <div className="sidebar-inner">
      {/* Logo */}
      <div className="sidebar-logo">
  <div className="logo-icon">
    <Image
      src="/logo.png"
      alt="Milky Feast Logo"
      width={100}
      height={100}
      priority
    />
  </div>

  <div>
    <div className="logo-name">ERP</div>
    <div className="logo-ver">System</div>
  </div>
</div>

      {/* Main nav */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">Main</div>
        {NAV.map(item => (
          <NavItem key={item.label} item={item} pathname={pathname}
            onNavigate={() => setDrawerOpen(false)} />
        ))}

        {/* Masters */}
        <div className="nav-section-label" style={{ marginTop: 14 }}>Masters</div>
        <button
          className={`nav-btn ${pathname?.includes('/masters') ? 'nav-active' : ''}`}
          onClick={() => setMastersOpen(v => !v)}>
          <Database size={16} strokeWidth={1.8} />
          <span className="nav-label">Master Data</span>
          <span className="nav-chevron">
            {mastersOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        </button>
        {mastersOpen && (
          <div className="nav-children">
            {MASTERS.map(m => (
              <Link key={m.href} href={m.href}
                className={`nav-child-link ${pathname === m.href ? 'nav-active' : ''}`}
                onClick={() => setDrawerOpen(false)}>
                <span className="child-dot" />
                {m.label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Bottom — Settings + Logout (always visible in sidebar) */}
      <div className="sidebar-bottom">
        <Link href="/dashboard/settings"
          className={`nav-btn ${pathname === '/dashboard/settings' ? 'nav-active' : ''}`}
          onClick={() => setDrawerOpen(false)}>
          <Settings size={16} strokeWidth={1.8} />
          <span className="nav-label">Settings</span>
        </Link>
        <button className="nav-btn nav-btn-logout" onClick={handleLogout}>
          <LogOut size={16} strokeWidth={1.8} />
          <span className="nav-label">Sign Out</span>
        </button>
        {/* User chip */}
        <div className="sidebar-user-chip">
          <div className="chip-avatar">
            {user?.full_name?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          <div>
            <div className="chip-name">{user?.full_name || 'Admin'}</div>
            <div className="chip-role">{user?.role || 'admin'}</div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="shell">
      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="desktop-sidebar">
        <SidebarContent />
      </aside>

      {/* ── MOBILE / TABLET DRAWER ── */}
      {drawerOpen && (
        <>
          <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} />
          <aside className="mobile-drawer">
            <button className="drawer-close" onClick={() => setDrawerOpen(false)}>
              <X size={18} />
            </button>
            <SidebarContent />
          </aside>
        </>
      )}

      {/* ── MAIN AREA ── */}
      <div className="main-area">

        {/* ── SINGLE TOP BAR ── */}
        <header className="topbar">
          {/* Left: hamburger + page title */}
          <div className="topbar-left">
            <button className="hamburger" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
            <div className="topbar-title">{pageTitle}</div>
          </div>

          {/* Right: notification + user avatar */}
          <div className="topbar-right">

            {/* Notification bell */}
            <div className="tb-dropdown" ref={notifRef}>
              <button
                className={`tb-icon-btn ${notifOpen ? 'tb-icon-btn-active' : ''}`}
                onClick={() => setNotifOpen(v => !v)}
                aria-label="Notifications"
              >
                <Bell size={18} />
                {totalBadge > 0 && (
                  <span className="tb-badge">{totalBadge > 9 ? '9+' : totalBadge}</span>
                )}
              </button>

              {notifOpen && (
                <div className="tb-panel notif-panel">
                  <div className="panel-hdr">
                    <span className="panel-title">Notifications</span>
                    {(notifications.length > 0) && (
                      <button className="panel-action" onClick={markAllRead}>
                        <CheckCheck size={12} /> Clear all
                      </button>
                    )}
                  </div>

                  <div className="notif-list">
                    {/* Low stock */}
                    {lowStockCount > 0 && (
                      <Link href="/dashboard/raw-materials" className="notif-item notif-item-warn"
                        onClick={() => setNotifOpen(false)}>
                        <div className="ni-icon ni-icon-warn">
                          <AlertTriangle size={13} color="var(--yellow)" />
                        </div>
                        <div className="ni-body">
                          <div className="ni-title">Low Stock — {lowStockCount} item{lowStockCount > 1 ? 's' : ''}</div>
                          <div className="ni-sub">Tap to view raw material stock</div>
                        </div>
                      </Link>
                    )}

                    {notifications.length === 0 && lowStockCount === 0 ? (
                      <div className="notif-empty">
                        <Bell size={26} />
                        <p>All clear!</p>
                        <span>No unread notifications</span>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id}
                          className={`notif-item ${n.type === 'low_stock' ? 'notif-item-warn' : 'notif-item-info'}`}
                          onClick={() => markOne(n.id)}>
                          <div className={`ni-icon ${n.type === 'low_stock' ? 'ni-icon-warn' : 'ni-icon-info'}`}>
                            {n.type === 'low_stock'
                              ? <AlertTriangle size={13} color="var(--yellow)" />
                              : <Bell size={13} color="var(--blue)" />
                            }
                          </div>
                          <div className="ni-body">
                            <div className="ni-title">{n.title}</div>
                            <div className="ni-sub">{n.message}</div>
                          </div>
                          <button className="ni-dismiss" onClick={e => { e.stopPropagation(); markOne(n.id) }}>×</button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User avatar — opens Settings + Sign out */}
            <div className="tb-user-wrap">
              <Link href="/dashboard/settings" className="tb-avatar" title="Settings">
                {user?.full_name?.charAt(0)?.toUpperCase() || 'A'}
              </Link>
            </div>
          </div>
        </header>

        {/* ── PAGE CONTENT ── */}
        <main className="page-content">
          {children}
        </main>
      </div>

      <style jsx global>{`
        /* ── Shell layout ── */
        .shell {
          display: flex;
          min-height: 100vh;
          background: var(--bg);
        }

        /* ── Desktop sidebar ── */
        .desktop-sidebar {
          position: fixed; top: 0; left: 0; bottom: 0;
          width: 232px;
          background: var(--surface);
          border-right: 1px solid var(--border);
          z-index: 40;
          overflow-y: auto; overflow-x: hidden;
          display: flex; flex-direction: column;
        }

        .sidebar-inner {
          display: flex; flex-direction: column;
          height: 100%; padding: 0 10px 16px;
        }

        /* Logo */
        .sidebar-logo {
          display: flex; align-items: center; gap: 10px;
          padding: 18px 8px 16px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 14px; flex-shrink: 0;
        }
        .logo-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}
        .logo-name { font-family: var(--font-display); font-size: 14px; font-weight: 800; color: var(--text); letter-spacing: -0.02em; }
        .logo-ver  { font-size: 10px; color: var(--text-3); margin-top: 1px; }

        /* Nav */
        .sidebar-nav { flex: 1; overflow-y: auto; padding-bottom: 8px; }
        .nav-section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-3); padding: 0 8px; margin-bottom: 4px; }

        .nav-btn {
          display: flex; align-items: center; gap: 9px;
          width: 100%; padding: 9px 10px; border-radius: var(--r-md);
          background: none; border: none; cursor: pointer;
          color: var(--text-2); font-size: 13px; font-family: var(--font-body);
          text-decoration: none; transition: all 0.13s; margin-bottom: 1px;
          text-align: left;
        }
        .nav-btn:hover { background: var(--surface-2); color: var(--text); }
        .nav-active { background: var(--brand-glow) !important; color: var(--brand) !important; font-weight: 500; }
        .nav-label { flex: 1; }
        .nav-chevron { color: var(--text-3); display: flex; margin-left: auto; }

        .nav-children { padding-left: 12px; margin-bottom: 2px; }
        .nav-child-link {
          display: flex; align-items: center; gap: 8px;
          padding: 7px 10px; border-radius: var(--r-sm);
          font-size: 12.5px; color: var(--text-2); text-decoration: none;
          transition: all 0.13s; margin-bottom: 1px;
        }
        .nav-child-link:hover { background: var(--surface-2); color: var(--text); }
        .child-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; opacity: 0.4; flex-shrink: 0; }

        /* Sidebar bottom */
        .sidebar-bottom { border-top: 1px solid var(--border); padding-top: 10px; flex-shrink: 0; }
        .nav-btn-logout { color: var(--red) !important; }
        .nav-btn-logout:hover { background: var(--red-dim) !important; }

        .sidebar-user-chip {
          display: flex; align-items: center; gap: 9px;
          padding: 10px 10px 2px; margin-top: 6px;
        }
        .chip-avatar {
          width: 28px; height: 28px; border-radius: var(--r-sm);
          background: var(--brand-glow); border: 1px solid rgba(249,115,22,0.25);
          color: var(--brand); font-family: var(--font-display); font-size: 12px; font-weight: 700;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .chip-name { font-size: 12px; font-weight: 600; color: var(--text); line-height: 1.2; }
        .chip-role { font-size: 10px; color: var(--text-3); text-transform: capitalize; }

        /* ── Mobile drawer ── */
        .drawer-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,0.6);
          backdrop-filter: blur(3px); z-index: 48;
          animation: fadeIn 0.15s ease;
        }
        .mobile-drawer {
          position: fixed; top: 0; left: 0; bottom: 0;
          width: 260px; background: var(--surface);
          border-right: 1px solid var(--border);
          z-index: 49; overflow-y: auto;
          animation: slideRight 0.22s cubic-bezier(0.16,1,0.3,1);
        }
        @keyframes slideRight {
          from { transform: translateX(-100%); }
          to   { transform: translateX(0); }
        }
        .drawer-close {
          position: absolute; top: 14px; right: 12px;
          width: 30px; height: 30px; border-radius: var(--r-sm);
          background: var(--surface-2); border: 1px solid var(--border);
          color: var(--text-2); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }

        /* ── Main area ── */
        .main-area {
          flex: 1; min-width: 0;
          display: flex; flex-direction: column;
          margin-left: 232px;
        }

        /* ── Top bar ── */
        .topbar {
          position: sticky; top: 0; z-index: 30;
          height: 56px;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          padding: 0 20px;
          display: flex; align-items: center; justify-content: space-between;
        }

        .topbar-left { display: flex; align-items: center; gap: 12px; }

        /* Hamburger hidden on desktop */
        .hamburger {
          display: none;
          width: 36px; height: 36px; border-radius: var(--r-md);
          background: var(--surface-2); border: 1px solid var(--border);
          color: var(--text-2); cursor: pointer;
          align-items: center; justify-content: center;
          transition: all 0.14s; flex-shrink: 0;
        }
        .hamburger:hover { background: var(--surface-3); color: var(--text); }

        .topbar-title {
          font-family: var(--font-display);
          font-size: 16px; font-weight: 700; color: var(--text);
          letter-spacing: -0.01em;
        }

        .topbar-right { display: flex; align-items: center; gap: 8px; }

        /* Notification icon */
        .tb-dropdown { position: relative; }
        .tb-icon-btn {
          position: relative; width: 36px; height: 36px;
          border-radius: var(--r-md);
          background: var(--surface-2); border: 1px solid var(--border);
          color: var(--text-2); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.14s;
        }
        .tb-icon-btn:hover, .tb-icon-btn-active {
          background: var(--surface-3); color: var(--text); border-color: var(--border-2);
        }
        .tb-badge {
          position: absolute; top: 3px; right: 3px;
          min-width: 16px; height: 16px;
          background: var(--red); color: #fff; border-radius: 99px;
          font-size: 9px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          padding: 0 3px; border: 2px solid var(--surface);
        }

        /* Notification panel */
        .tb-panel {
          position: absolute; top: calc(100% + 10px); right: 0;
          background: var(--surface); border: 1px solid var(--border-2);
          border-radius: var(--r-lg);
          box-shadow: 0 20px 50px rgba(0,0,0,0.4);
          z-index: 100;
          animation: fadeSlide 0.15s ease;
          overflow: hidden;
        }
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .notif-panel { width: 320px; }

        .panel-hdr {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px 10px; border-bottom: 1px solid var(--border);
        }
        .panel-title { font-family: var(--font-display); font-size: 13px; font-weight: 700; color: var(--text); }
        .panel-action {
          display: flex; align-items: center; gap: 5px;
          background: none; border: none; color: var(--brand);
          font-size: 11px; cursor: pointer; font-family: var(--font-body);
          padding: 4px 8px; border-radius: var(--r-sm); transition: background 0.12s;
        }
        .panel-action:hover { background: var(--brand-glow); }

        .notif-list { max-height: 340px; overflow-y: auto; }

        .notif-empty {
          padding: 32px; text-align: center; color: var(--text-3);
        }
        .notif-empty svg { margin: 0 auto 10px; opacity: 0.2; display: block; }
        .notif-empty p { font-size: 14px; font-weight: 600; color: var(--text-2); margin-bottom: 3px; }
        .notif-empty span { font-size: 12px; }

        .notif-item {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 11px 16px; cursor: pointer;
          border-bottom: 1px solid var(--border);
          transition: background 0.12s; text-decoration: none;
          position: relative;
        }
        .notif-item:last-child { border-bottom: none; }
        .notif-item-warn:hover { background: rgba(251,191,36,0.06); }
        .notif-item-info:hover { background: rgba(96,165,250,0.06); }

        .ni-icon {
          width: 28px; height: 28px; border-radius: var(--r-sm);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .ni-icon-warn { background: var(--yellow-dim); }
        .ni-icon-info { background: var(--blue-dim); }
        .ni-body { flex: 1; min-width: 0; }
        .ni-title { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
        .ni-sub   { font-size: 11px; color: var(--text-2); line-height: 1.4; }
        .ni-dismiss {
          position: absolute; top: 8px; right: 10px;
          width: 18px; height: 18px; border-radius: 50%;
          background: var(--surface-3); border: none; color: var(--text-3);
          cursor: pointer; font-size: 13px; line-height: 1;
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity 0.15s;
        }
        .notif-item:hover .ni-dismiss { opacity: 1; }

        /* User avatar in topbar */
        .tb-user-wrap { }
        .tb-avatar {
          width: 34px; height: 34px; border-radius: var(--r-md);
          background: var(--brand-glow); border: 1px solid rgba(249,115,22,0.3);
          color: var(--brand); font-family: var(--font-display);
          font-size: 14px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          text-decoration: none; cursor: pointer; transition: all 0.14s;
          flex-shrink: 0;
        }
        .tb-avatar:hover {
          background: rgba(249,115,22,0.25);
          box-shadow: 0 0 0 3px var(--brand-glow);
        }

        /* ── Page content ── */
        .page-content {
          flex: 1; padding: 24px 28px;
          max-width: 1400px; width: 100%;
        }

        /* ── Responsive: tablet + mobile ── */
        @media (max-width: 900px) {
          .desktop-sidebar { display: none; }
          .main-area { margin-left: 0; }
          .hamburger { display: flex; }
          .topbar { padding: 0 16px; }
          .page-content { padding: 20px 16px; }

          /* Mobile notification popup fix */
.notif-panel {
  position: fixed;
  top: 64px;
  left: 12px;
  right: 12px;
  width: auto;
  max-width: none;

  max-height: calc(100vh - 80px);
  overflow: hidden;

  border-radius: 16px;
}

.notif-list {
  max-height: calc(100vh - 160px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
        }

        @media (max-width: 480px) {
          .topbar-title { font-size: 14px; }
          .page-content { padding: 16px 12px; }
        }
      `}</style>
    </div>
  )
}
