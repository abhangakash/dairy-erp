'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Milk,
  LayoutDashboard,
  FlaskConical,
  ShoppingCart,
  Users,
  Receipt,
  Package,
  Truck,
  HandCoins,
  FileBarChart2,
  Settings,
  ChevronDown,
  ChevronRight,
  Database,
  Menu,
  X,
} from 'lucide-react'

const NAV = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Production',
    icon: FlaskConical,
    children: [
      { label: 'Daily Entry',   href: '/dashboard/production' },
      { label: 'History',       href: '/dashboard/production/history' },
    ],
  },
  {
    label: 'Sales',
    icon: ShoppingCart,
    children: [
      { label: 'Daily Entry',   href: '/dashboard/sales' },
      { label: 'History',       href: '/dashboard/sales/history' },
    ],
  },
  {
    label: 'Workers',
    icon: Users,
    children: [
      { label: 'Attendance',    href: '/dashboard/workers/attendance' },
      { label: 'Salary',        href: '/dashboard/workers/salary' },
    ],
  },
  {
    label: 'Daily Expenses',
    href: '/dashboard/expenses',
    icon: Receipt,
  },
  {
    label: 'Raw Materials',
    icon: Package,
    children: [
      { label: 'Stock Overview', href: '/dashboard/raw-materials' },
      { label: 'Stock Entry',    href: '/dashboard/raw-materials/entry' },
    ],
  },
  {
    label: 'Vehicles',
    href: '/dashboard/vehicles',
    icon: Truck,
  },
  {
    label: 'Partners',
    href: '/dashboard/partners',
    icon: HandCoins,
  },
  {
    label: 'Reports',
    href: '/dashboard/reports',
    icon: FileBarChart2,
  },
]

const MASTERS_NAV = [
  { label: 'Products',       href: '/dashboard/masters/products' },
  { label: 'Distributors',   href: '/dashboard/masters/distributors' },
  { label: 'Workers',        href: '/dashboard/masters/workers' },
  { label: 'Raw Materials',  href: '/dashboard/masters/raw-materials' },
  { label: 'Partners',       href: '/dashboard/masters/partners' },
  { label: 'Vehicles',       href: '/dashboard/masters/vehicles' },
]

function NavItem({ item, pathname, depth = 0 }) {
  const isActive = item.href
    ? pathname === item.href
    : item.children?.some(c => pathname.startsWith(c.href))

  const [open, setOpen] = useState(isActive)

  if (item.children) {
    return (
      <div className="nav-group">
        <button
          className={`nav-item nav-group-btn ${isActive ? 'nav-item-active' : ''}`}
          onClick={() => setOpen(v => !v)}
        >
          {item.icon && <item.icon size={16} strokeWidth={1.8} />}
          <span className="nav-label">{item.label}</span>
          <span className="nav-chevron">
            {open
              ? <ChevronDown size={13} />
              : <ChevronRight size={13} />
            }
          </span>
        </button>
        {open && (
          <div className="nav-children">
            {item.children.map(child => (
              <Link
                key={child.href}
                href={child.href}
                className={`nav-item nav-child ${pathname === child.href ? 'nav-item-active' : ''}`}
              >
                <span className="nav-child-dot" />
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Link
      href={item.href}
      className={`nav-item ${pathname === item.href ? 'nav-item-active' : ''}`}
    >
      {item.icon && <item.icon size={16} strokeWidth={1.8} />}
      <span className="nav-label">{item.label}</span>
    </Link>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mastersOpen, setMastersOpen] = useState(
    pathname.startsWith('/dashboard/masters')
  )

  const sidebarContent = (
    <div className="sidebar-inner">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Milk size={20} color="#f97316" strokeWidth={1.8} />
        </div>
        <div>
          <div className="sidebar-logo-name">Dairy ERP</div>
          <div className="sidebar-logo-ver">v1.0</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">Main</div>
        {NAV.map(item => (
          <NavItem key={item.label} item={item} pathname={pathname} />
        ))}

        {/* Masters section */}
        <div className="nav-section-label" style={{ marginTop: 16 }}>Masters</div>
        <div className="nav-group">
          <button
            className={`nav-item nav-group-btn ${mastersOpen || pathname.startsWith('/dashboard/masters') ? 'nav-item-active' : ''}`}
            onClick={() => setMastersOpen(v => !v)}
          >
            <Database size={16} strokeWidth={1.8} />
            <span className="nav-label">Master Data</span>
            <span className="nav-chevron">
              {mastersOpen
                ? <ChevronDown size={13} />
                : <ChevronRight size={13} />
              }
            </span>
          </button>
          {mastersOpen && (
            <div className="nav-children">
              {MASTERS_NAV.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item nav-child ${pathname === item.href ? 'nav-item-active' : ''}`}
                >
                  <span className="nav-child-dot" />
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Bottom */}
      <div className="sidebar-bottom">
        <Link
          href="/dashboard/settings"
          className={`nav-item ${pathname === '/dashboard/settings' ? 'nav-item-active' : ''}`}
        >
          <Settings size={16} strokeWidth={1.8} />
          <span className="nav-label">Settings</span>
        </Link>
        <div className="sidebar-version">
          Internal use only
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sidebar-desktop">
        {sidebarContent}
      </aside>

      {/* Mobile toggle */}
      <button
        className="sidebar-mobile-toggle"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="sidebar-backdrop"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="sidebar-mobile">
            <button
              className="sidebar-close-btn"
              onClick={() => setMobileOpen(false)}
            >
              <X size={18} />
            </button>
            {sidebarContent}
          </aside>
        </>
      )}

      <style jsx>{`
        /* Desktop */
        .sidebar-desktop {
          position: fixed;
          top: 0; left: 0; bottom: 0;
          width: var(--sidebar-w);
          background: var(--surface);
          border-right: 1px solid var(--border);
          z-index: 40;
          overflow-y: auto;
          overflow-x: hidden;
        }
        .sidebar-inner {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 0 12px 16px;
        }

        /* Logo */
        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 20px 8px 18px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 16px;
        }
        .sidebar-logo-icon {
          width: 36px; height: 36px;
          background: var(--brand-glow);
          border: 1px solid rgba(249,115,22,0.25);
          border-radius: var(--r-sm);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .sidebar-logo-name {
          font-family: var(--font-display);
          font-size: 15px;
          font-weight: 700;
          color: var(--text);
        }
        .sidebar-logo-ver {
          font-size: 10px;
          color: var(--text-3);
        }

        /* Nav */
        .sidebar-nav { flex: 1; }

        .nav-section-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-3);
          padding: 0 8px;
          margin-bottom: 6px;
        }

        :global(.nav-item) {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 10px;
          border-radius: var(--r-md);
          color: var(--text-2);
          font-size: 13.5px;
          font-weight: 400;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.14s ease;
          border: none;
          background: none;
          width: 100%;
          text-align: left;
          margin-bottom: 1px;
        }
        :global(.nav-item:hover) {
          background: var(--surface-2);
          color: var(--text);
        }
        :global(.nav-item-active) {
          background: var(--brand-glow) !important;
          color: var(--brand) !important;
          font-weight: 500;
        }

        :global(.nav-label) { flex: 1; }

        :global(.nav-group-btn) { cursor: pointer; }

        :global(.nav-children) {
          padding-left: 14px;
          margin-top: 2px;
        }
        :global(.nav-child) {
          padding: 7px 10px !important;
          font-size: 13px !important;
        }
        :global(.nav-child-dot) {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: currentColor;
          opacity: 0.4;
          flex-shrink: 0;
        }

        :global(.nav-chevron) {
          color: var(--text-3);
          display: flex;
        }

        /* Bottom */
        .sidebar-bottom {
          border-top: 1px solid var(--border);
          padding-top: 12px;
          margin-top: 8px;
        }
        .sidebar-version {
          font-size: 10px;
          color: var(--text-3);
          text-align: center;
          padding: 8px;
        }

        /* Mobile toggle */
        .sidebar-mobile-toggle {
          display: none;
          position: fixed;
          top: 14px; left: 14px;
          z-index: 50;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          padding: 8px;
          color: var(--text);
          cursor: pointer;
        }

        .sidebar-backdrop {
          display: none;
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(2px);
          z-index: 48;
        }

        .sidebar-mobile {
          display: none;
          position: fixed;
          top: 0; left: 0; bottom: 0;
          width: var(--sidebar-w);
          background: var(--surface);
          border-right: 1px solid var(--border);
          z-index: 49;
          overflow-y: auto;
          animation: slideRight 0.2s ease;
        }

        @keyframes slideRight {
          from { transform: translateX(-100%); }
          to   { transform: translateX(0); }
        }

        .sidebar-close-btn {
          position: absolute;
          top: 14px; right: 12px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          padding: 5px;
          color: var(--text-2);
          cursor: pointer;
        }

        @media (max-width: 768px) {
          .sidebar-desktop         { display: none; }
          .sidebar-mobile-toggle   { display: flex; }
          .sidebar-backdrop        { display: block; }
          .sidebar-mobile          { display: block; }
        }
      `}</style>
    </>
  )
}