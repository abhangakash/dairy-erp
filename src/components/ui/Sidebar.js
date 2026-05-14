'use client';
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Milk, LayoutDashboard, FlaskConical, ShoppingCart,
  Users, Receipt, Package, Truck, HandCoins,
  FileBarChart2, Settings, ChevronDown, ChevronRight,
  Database, Menu, X,
} from 'lucide-react'

const NAV = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  {
    label: 'Production', icon: FlaskConical,
    children: [
      { label: 'Daily Entry', href: '/dashboard/production' },
      { label: 'History',     href: '/dashboard/production/history' },
    ],
  },
  {
    label: 'Sales', icon: ShoppingCart,
    children: [
      { label: 'Daily Entry', href: '/dashboard/sales' },
      { label: 'History',     href: '/dashboard/sales/history' },
    ],
  },
  {
    label: 'Workers', icon: Users,
    children: [
      { label: 'Attendance', href: '/dashboard/workers/attendance' },
      { label: 'Salary',     href: '/dashboard/workers/salary' },
    ],
  },
  { label: 'Daily Expenses', href: '/dashboard/expenses', icon: Receipt },
  {
    label: 'Raw Materials', icon: Package,
    children: [
      { label: 'Stock Overview', href: '/dashboard/raw-materials' },
      { label: 'Stock Entry',    href: '/dashboard/raw-materials/entry' },
    ],
  },
  { label: 'Vehicles', href: '/dashboard/vehicles', icon: Truck },
  { label: 'Partners', href: '/dashboard/partners', icon: HandCoins },
  { label: 'Reports',  href: '/dashboard/reports',  icon: FileBarChart2 },
]

const MASTERS_NAV = [
  { label: 'Products',      href: '/dashboard/masters/products' },
  { label: 'Distributors',  href: '/dashboard/masters/distributors' },
  { label: 'Workers',       href: '/dashboard/masters/workers' },
  { label: 'Raw Materials', href: '/dashboard/masters/raw-materials' },
  { label: 'Partners',      href: '/dashboard/masters/partners' },
  { label: 'Vehicles',      href: '/dashboard/masters/vehicles' },
]

const s = {
  sidebarDesktop: {
    position: 'fixed', top: 0, left: 0, bottom: 0,
    width: 'var(--sidebar-w)',
    background: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    zIndex: 40,
    overflowY: 'auto', overflowX: 'hidden',
  },
  sidebarMobile: {
    position: 'fixed', top: 0, left: 0, bottom: 0,
    width: 'var(--sidebar-w)',
    background: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    zIndex: 49,
    overflowY: 'auto',
  },
  inner: {
    display: 'flex', flexDirection: 'column',
    height: '100%', padding: '0 12px 16px',
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '20px 8px 18px',
    borderBottom: '1px solid var(--border)',
    marginBottom: 16,
  },
  logoIcon: {
    width: 36, height: 36,
    background: 'var(--brand-glow)',
    border: '1px solid rgba(249,115,22,0.25)',
    borderRadius: 'var(--r-sm)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  logoName: {
    fontFamily: 'var(--font-display)', fontSize: 15,
    fontWeight: 700, color: 'var(--text)',
  },
  logoVer: { fontSize: 10, color: 'var(--text-3)' },
  nav: { flex: 1 },
  sectionLabel: {
    fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.1em',
    color: 'var(--text-3)', padding: '0 8px', marginBottom: 6,
  },
  navItem: (active) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 10px',
    borderRadius: 'var(--r-md)',
    color: active ? 'var(--brand)' : 'var(--text-2)',
    background: active ? 'var(--brand-glow)' : 'none',
    fontWeight: active ? 500 : 400,
    fontSize: 13.5, textDecoration: 'none',
    cursor: 'pointer', border: 'none', width: '100%',
    textAlign: 'left', marginBottom: 1,
  }),
  navChild: (active) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '7px 10px',
    borderRadius: 'var(--r-md)',
    color: active ? 'var(--brand)' : 'var(--text-2)',
    background: active ? 'var(--brand-glow)' : 'none',
    fontWeight: active ? 500 : 400,
    fontSize: 13, textDecoration: 'none',
    cursor: 'pointer', marginBottom: 1,
    display: 'flex',
  }),
  navChildren: { paddingLeft: 14, marginTop: 2 },
  dot: {
    width: 5, height: 5, borderRadius: '50%',
    background: 'currentColor', opacity: 0.4, flexShrink: 0,
  },
  chevron: { color: 'var(--text-3)', display: 'flex', marginLeft: 'auto' },
  bottom: {
    borderTop: '1px solid var(--border)',
    paddingTop: 12, marginTop: 8,
  },
  version: {
    fontSize: 10, color: 'var(--text-3)',
    textAlign: 'center', padding: 8,
  },
  mobileToggle: {
    position: 'fixed', top: 14, left: 14, zIndex: 50,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)',
    padding: 8, color: 'var(--text)', cursor: 'pointer',
  },
  backdrop: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(2px)', zIndex: 48,
  },
  closeBtn: {
    position: 'absolute', top: 14, right: 12,
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-sm)',
    padding: 5, color: 'var(--text-2)', cursor: 'pointer',
  },
}

function NavItem({ item, pathname }) {
  const isActive = item.href
    ? pathname === item.href
    : item.children?.some(c => pathname.startsWith(c.href))
  const [open, setOpen] = useState(isActive)

  if (item.children) {
    return (
      <div>
        <button style={s.navItem(isActive)} onClick={() => setOpen(v => !v)}>
          {item.icon && <item.icon size={16} strokeWidth={1.8} />}
          <span style={{ flex: 1 }}>{item.label}</span>
          <span style={s.chevron}>
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
        </button>
        {open && (
          <div style={s.navChildren}>
            {item.children.map(child => (
              <Link key={child.href} href={child.href}
                style={s.navChild(pathname === child.href)}>
                <span style={s.dot} />
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Link href={item.href} style={s.navItem(pathname === item.href)}>
      {item.icon && <item.icon size={16} strokeWidth={1.8} />}
      <span style={{ flex: 1 }}>{item.label}</span>
    </Link>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mastersOpen, setMastersOpen] = useState(
    pathname.startsWith('/dashboard/masters')
  )

  const isMastersActive = pathname.startsWith('/dashboard/masters')

  const sidebarContent = (
    <div style={s.inner}>
      {/* Logo */}
      <div style={s.logo}>
        <div style={s.logoIcon}>
          <Milk size={20} color="#f97316" strokeWidth={1.8} />
        </div>
        <div>
          <div style={s.logoName}>Dairy ERP</div>
          <div style={s.logoVer}>v1.0</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={s.nav}>
        <div style={s.sectionLabel}>Main</div>
        {NAV.map(item => (
          <NavItem key={item.label} item={item} pathname={pathname} />
        ))}

        {/* Masters */}
        <div style={{ ...s.sectionLabel, marginTop: 16 }}>Masters</div>
        <div>
          <button
            style={s.navItem(isMastersActive)}
            onClick={() => setMastersOpen(v => !v)}
          >
            <Database size={16} strokeWidth={1.8} />
            <span style={{ flex: 1 }}>Master Data</span>
            <span style={s.chevron}>
              {mastersOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </span>
          </button>
          {mastersOpen && (
            <div style={s.navChildren}>
              {MASTERS_NAV.map(item => (
                <Link key={item.href} href={item.href}
                  style={s.navChild(pathname === item.href)}>
                  <span style={s.dot} />
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Bottom */}
      <div style={s.bottom}>
        <Link href="/dashboard/settings" style={s.navItem(pathname === '/dashboard/settings')}>
          <Settings size={16} strokeWidth={1.8} />
          <span style={{ flex: 1 }}>Settings</span>
        </Link>
        <div style={s.version}>Internal use only</div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside style={s.sidebarDesktop}>{sidebarContent}</aside>

      {/* Mobile toggle — hidden on desktop via inline check */}
      <button
        style={{ ...s.mobileToggle, display: 'none' }}
        id="sidebar-mobile-toggle"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div style={s.backdrop} onClick={() => setMobileOpen(false)} />
          <aside style={s.sidebarMobile}>
            <button style={s.closeBtn} onClick={() => setMobileOpen(false)}>
              <X size={18} />
            </button>
            {sidebarContent}
          </aside>
        </>
      )}

      <style>{`
        @media (max-width: 768px) {
          #sidebar-mobile-toggle { display: flex !important; }
          aside[data-sidebar="desktop"] { display: none !important; }
        }
      `}</style>
    </>
  )
}