'use client'

import { useState, useEffect } from 'react'
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

function NavItem({ item, pathname, onNavigate }) {
  const isActive = item.href
    ? pathname === item.href
    : item.children?.some(c => pathname.startsWith(c.href))
  const [open, setOpen] = useState(isActive)

  if (item.children) {
    return (
      <div className="nav-group">
        <button
          className={`nav-item nav-group-btn${isActive ? ' nav-item-active' : ''}`}
          onClick={() => setOpen(v => !v)}
        >
          {item.icon && <item.icon size={18} strokeWidth={2} />}
          <span className="nav-label">{item.label}</span>
          <span className="nav-chevron">
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        </button>
        {open && (
          <div className="nav-children">
            {item.children.map(child => (
              <Link
                key={child.href}
                href={child.href}
                className={`nav-item nav-child${pathname === child.href ? ' nav-item-active' : ''}`}
                onClick={onNavigate}
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
      className={`nav-item${pathname === item.href ? ' nav-item-active' : ''}`}
      onClick={onNavigate}
    >
      {item.icon && <item.icon size={18} strokeWidth={2} />}
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

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const isMastersActive = pathname.startsWith('/dashboard/masters')

  const sidebarContent = (
    <div className="sidebar-inner">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Milk size={22} color="#f97316" strokeWidth={2} />
        </div>
        <div>
          <div className="sidebar-logo-name">Dairy ERP</div>
          <div className="sidebar-logo-ver">PRO EDITION</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Main Operations</div>
        {NAV.map(item => (
          <NavItem
            key={item.label}
            item={item}
            pathname={pathname}
            onNavigate={() => setMobileOpen(false)}
          />
        ))}

        <div className="nav-section-label" style={{ marginTop: 24 }}>System Masters</div>
        <div className="nav-group">
          <button
            className={`nav-item nav-group-btn${isMastersActive ? ' nav-item-active' : ''}`}
            onClick={() => setMastersOpen(v => !v)}
          >
            <Database size={18} strokeWidth={2} />
            <span className="nav-label">Master Data</span>
            <span className="nav-chevron">
              {mastersOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          </button>
          {mastersOpen && (
            <div className="nav-children">
              {MASTERS_NAV.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item nav-child${pathname === item.href ? ' nav-item-active' : ''}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="nav-child-dot" />
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className="sidebar-bottom">
        <Link
          href="/dashboard/settings"
          className={`nav-item${pathname === '/dashboard/settings' ? ' nav-item-active' : ''}`}
          onClick={() => setMobileOpen(false)}
        >
          <Settings size={18} strokeWidth={2} />
          <span className="nav-label">Settings</span>
        </Link>
        <div className="sidebar-version">Secure Terminal v2.4</div>
      </div>
    </div>
  )

  return (
    <>
      <style>{`
        :root {
          --sidebar-w: 280px;
          --surface: #0a0a0a;
          --surface-2: #141414;
          --border: #222;
          --text: #ffffff;
          --text-2: #a1a1aa;
          --text-3: #52525b;
          --brand: #f97316;
          --brand-glow: rgba(249, 115, 22, 0.1);
          --r-md: 12px;
          --r-sm: 8px;
        }

        /* Desktop Sidebar Styles */
        .sidebar-desktop {
          position: fixed; top: 0; left: 0; bottom: 0;
          width: var(--sidebar-w);
          background: var(--surface);
          border-right: 1px solid var(--border);
          z-index: 40; overflow-y: auto; overflow-x: hidden;
        }

        .sidebar-inner {
          display: flex; flex-direction: column;
          height: 100%; padding: 0 16px 20px;
        }

        .sidebar-logo {
          display: flex; align-items: center; gap: 14px;
          padding: 32px 8px 24px;
          margin-bottom: 8px;
        }

        .sidebar-logo-icon {
          width: 42px; height: 42px;
          background: var(--brand-glow);
          border: 1px solid rgba(249,115,22,0.2);
          border-radius: var(--r-md);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 20px rgba(249,115,22,0.05);
        }

        .sidebar-logo-name {
          font-size: 16px; font-weight: 800; color: var(--text);
          letter-spacing: -0.01em;
        }

        .sidebar-logo-ver { 
          font-size: 9px; font-weight: 700; color: var(--brand); 
          letter-spacing: 0.1em; opacity: 0.8;
        }

        .sidebar-nav { flex: 1; }

        .nav-section-label {
          font-size: 11px; font-weight: 800;
          text-transform: uppercase; letter-spacing: 0.08em;
          color: var(--text-3); padding: 0 12px; margin-bottom: 10px;
        }

        .nav-item {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 14px; border-radius: var(--r-md);
          color: var(--text-2); font-size: 14.5px; font-weight: 500;
          text-decoration: none; cursor: pointer; border: none;
          background: none; width: 100%; text-align: left;
          margin-bottom: 4px; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Mobile & Tablet Hit Area Optimization */
        @media (max-width: 1024px) {
          .nav-item { padding: 14px 16px; margin-bottom: 6px; }
        }

        .nav-item:hover { 
          background: var(--surface-2); 
          color: var(--text);
          transform: translateX(4px);
        }

        .nav-item-active {
          background: var(--brand-glow) !important;
          color: var(--brand) !important;
          border: 1px solid rgba(249,115,22,0.15);
        }

        .nav-label { flex: 1; }
        .nav-chevron { opacity: 0.5; }

        .nav-children { 
          padding-left: 20px; 
          margin: 4px 0 12px 0;
          border-left: 1px solid var(--border);
          margin-left: 22px;
        }

        .nav-child { 
          padding: 10px 14px !important; 
          font-size: 13.5px !important; 
          color: var(--text-3);
        }
        
        .nav-child:hover { color: var(--text); }

        .nav-child-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: currentColor; opacity: 0.3; flex-shrink: 0;
        }

        .sidebar-bottom {
          border-top: 1px solid var(--border);
          padding-top: 16px; margin-top: 16px;
        }

        .sidebar-version {
          font-size: 11px; color: var(--text-3);
          text-align: center; padding: 12px; font-weight: 500;
        }

        /* Mobile Specific UI */
        .sidebar-mobile-header {
           display: none;
           position: fixed; top: 0; left: 0; right: 0;
           height: 64px; background: rgba(10,10,10,0.8);
           backdrop-filter: blur(12px); border-bottom: 1px solid var(--border);
           z-index: 45; align-items: center; padding: 0 16px;
        }

        .sidebar-mobile-toggle {
          display: none;
          background: var(--surface-2); border: 1px solid var(--border);
          border-radius: var(--r-sm); width: 40px; height: 40px;
          color: var(--text); cursor: pointer;
          align-items: center; justify-content: center;
        }

        .sidebar-backdrop {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.8);
          backdrop-filter: blur(4px); z-index: 48;
        }

        .sidebar-mobile {
          position: fixed; top: 0; left: 0; bottom: 0;
          width: 300px; max-width: 85vw;
          background: var(--surface);
          border-right: 1px solid var(--border);
          z-index: 49; overflow-y: auto;
          box-shadow: 20px 0 50px rgba(0,0,0,0.5);
          animation: slideRight 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .sidebar-close-btn {
          position: absolute; top: 24px; right: 16px;
          background: var(--surface-2); border: 1px solid var(--border);
          border-radius: var(--r-sm); width: 36px; height: 36px;
          color: var(--text-2); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          z-index: 10;
        }

        @keyframes slideRight {
          from { transform: translateX(-100%); }
          to   { transform: translateX(0); }
        }

        @media (max-width: 1024px) {
          .sidebar-desktop { display: none !important; }
          .sidebar-mobile-header { display: flex !important; }
          .sidebar-mobile-toggle { display: flex !important; }
          /* Add space for the top header in the content area */
          body { padding-top: 64px; }
        }
      `}</style>

      {/* Desktop View */}
      <aside className="sidebar-desktop">{sidebarContent}</aside>

      {/* Mobile Top Navigation Bar */}
      <div className="sidebar-mobile-header">
        <button
          className="sidebar-mobile-toggle"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <div style={{ marginLeft: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Milk size={18} color="var(--brand)" />
            <span style={{ fontWeight: 800, fontSize: '14px' }}>DAIRY ERP</span>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <>
          <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />
          <aside className="sidebar-mobile">
            <button
              className="sidebar-close-btn"
              onClick={() => setMobileOpen(false)}
            >
              <X size={20} />
            </button>
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  )
}

// /*'use client'

// import { useState, useEffect } from 'react'
// import Link from 'next/link'
// import { usePathname } from 'next/navigation'
// import {
//   Milk, LayoutDashboard, FlaskConical, ShoppingCart,
//   Users, Receipt, Package, Truck, HandCoins,
//   FileBarChart2, Settings, ChevronDown, ChevronRight,
//   Database, Menu, X,
// } from 'lucide-react'

// const NAV = [
//   { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
//   {
//     label: 'Production', icon: FlaskConical,
//     children: [
//       { label: 'Daily Entry', href: '/dashboard/production' },
//       { label: 'History',     href: '/dashboard/production/history' },
//     ],
//   },
//   {
//     label: 'Sales', icon: ShoppingCart,
//     children: [
//       { label: 'Daily Entry', href: '/dashboard/sales' },
//       { label: 'History',     href: '/dashboard/sales/history' },
//     ],
//   },
//   {
//     label: 'Workers', icon: Users,
//     children: [
//       { label: 'Attendance', href: '/dashboard/workers/attendance' },
//       { label: 'Salary',     href: '/dashboard/workers/salary' },
//     ],
//   },
//   { label: 'Daily Expenses', href: '/dashboard/expenses', icon: Receipt },
//   {
//     label: 'Raw Materials', icon: Package,
//     children: [
//       { label: 'Stock Overview', href: '/dashboard/raw-materials' },
//       { label: 'Stock Entry',    href: '/dashboard/raw-materials/entry' },
//     ],
//   },
//   { label: 'Vehicles', href: '/dashboard/vehicles', icon: Truck },
//   { label: 'Partners', href: '/dashboard/partners', icon: HandCoins },
//   { label: 'Reports',  href: '/dashboard/reports',  icon: FileBarChart2 },
// ]

// const MASTERS_NAV = [
//   { label: 'Products',      href: '/dashboard/masters/products' },
//   { label: 'Distributors',  href: '/dashboard/masters/distributors' },
//   { label: 'Workers',       href: '/dashboard/masters/workers' },
//   { label: 'Raw Materials', href: '/dashboard/masters/raw-materials' },
//   { label: 'Partners',      href: '/dashboard/masters/partners' },
//   { label: 'Vehicles',      href: '/dashboard/masters/vehicles' },
// ]

// function NavItem({ item, pathname, onNavigate }) {
//   const isActive = item.href
//     ? pathname === item.href
//     : item.children?.some(c => pathname.startsWith(c.href))
//   const [open, setOpen] = useState(isActive)

//   if (item.children) {
//     return (
//       <div className="nav-group">
//         <button
//           className={`nav-item nav-group-btn${isActive ? ' nav-item-active' : ''}`}
//           onClick={() => setOpen(v => !v)}
//         >
//           {item.icon && <item.icon size={18} strokeWidth={2} />}
//           <span className="nav-label">{item.label}</span>
//           <span className="nav-chevron">
//             {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
//           </span>
//         </button>
//         {open && (
//           <div className="nav-children">
//             {item.children.map(child => (
//               <Link
//                 key={child.href}
//                 href={child.href}
//                 className={`nav-item nav-child${pathname === child.href ? ' nav-item-active' : ''}`}
//                 onClick={onNavigate}
//               >
//                 <span className="nav-child-dot" />
//                 {child.label}
//               </Link>
//             ))}
//           </div>
//         )}
//       </div>
//     )
//   }

//   return (
//     <Link
//       href={item.href}
//       className={`nav-item${pathname === item.href ? ' nav-item-active' : ''}`}
//       onClick={onNavigate}
//     >
//       {item.icon && <item.icon size={18} strokeWidth={2} />}
//       <span className="nav-label">{item.label}</span>
//     </Link>
//   )
// }

// export default function Sidebar() {
//   const pathname = usePathname()
//   const [mobileOpen, setMobileOpen] = useState(false)
//   const [mastersOpen, setMastersOpen] = useState(pathname.startsWith('/dashboard/masters'))

//   useEffect(() => {
//     setMobileOpen(false)
//   }, [pathname])

//   const isMastersActive = pathname.startsWith('/dashboard/masters')

//   const sidebarContent = (
//     <div className="sidebar-inner">
//       <div className="sidebar-logo">
//         <div className="sidebar-logo-icon">
//           <Milk size={22} color="var(--brand)" strokeWidth={2} />
//         </div>
//         <div>
//           <div className="sidebar-logo-name">Dairy ERP</div>
//           <div className="sidebar-logo-ver">ADMIN PORTAL</div>
//         </div>
//       </div>

//       <nav className="sidebar-nav">
//         <div className="nav-section-label">General</div>
//         {NAV.map(item => (
//           <NavItem
//             key={item.label}
//             item={item}
//             pathname={pathname}
//             onNavigate={() => setMobileOpen(false)}
//           />
//         ))}

//         <div className="nav-section-label" style={{ marginTop: 24 }}>System Config</div>
//         <div className="nav-group">
//           <button
//             className={`nav-item nav-group-btn${isMastersActive ? ' nav-item-active' : ''}`}
//             onClick={() => setMastersOpen(v => !v)}
//           >
//             <Database size={18} strokeWidth={2} />
//             <span className="nav-label">Master Data</span>
//             <span className="nav-chevron">
//               {mastersOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
//             </span>
//           </button>
//           {mastersOpen && (
//             <div className="nav-children">
//               {MASTERS_NAV.map(item => (
//                 <Link
//                   key={item.href}
//                   href={item.href}
//                   className={`nav-item nav-child${pathname === item.href ? ' nav-item-active' : ''}`}
//                   onClick={() => setMobileOpen(false)}
//                 >
//                   <span className="nav-child-dot" />
//                   {item.label}
//                 </Link>
//               ))}
//             </div>
//           )}
//         </div>
//       </nav>

//       <div className="sidebar-bottom">
//         <Link
//           href="/dashboard/settings"
//           className={`nav-item${pathname === '/dashboard/settings' ? ' nav-item-active' : ''}`}
//           onClick={() => setMobileOpen(false)}
//         >
//           <Settings size={18} strokeWidth={2} />
//           <span className="nav-label">Settings</span>
//         </Link>
//         <div className="sidebar-version">v2.1.4 Build Stable</div>
//       </div>
//     </div>
//   )

//   return (
//     <>
//       <style>{`
//         :root {
//           --sidebar-w: 270px;
//           --surface: #f8fafc;       /* Off-White Sidebar */
//           --surface-2: #f1f5f9;     /* Light Grey Hover */
//           --border: #e2e8f0;        /* Subtle Slate Border */
//           --text: #0f172a;          /* Dark Navy Text */
//           --text-2: #475569;        /* Muted Navy */
//           --text-3: #94a3b8;        /* Light Grey for Labels */
//           --brand: #2563eb;         /* Trust Blue */
//           --brand-bg: #eff6ff;      /* Very Light Blue */
//           --r-md: 10px;
//           --r-sm: 6px;
//         }

//         .sidebar-desktop {
//           position: fixed; top: 0; left: 0; bottom: 0;
//           width: var(--sidebar-w);
//           background: var(--surface);
//           border-right: 1px solid var(--border);
//           z-index: 40; overflow-y: auto;
//         }

//         .sidebar-inner {
//           display: flex; flex-direction: column;
//           height: 100%; padding: 0 16px 20px;
//         }

//         .sidebar-logo {
//           display: flex; align-items: center; gap: 12px;
//           padding: 32px 8px 24px;
//         }

//         .sidebar-logo-icon {
//           width: 40px; height: 40px;
//           background: var(--brand-bg);
//           border-radius: var(--r-md);
//           display: flex; align-items: center; justify-content: center;
//           border: 1px solid rgba(37, 99, 235, 0.1);
//         }

//         .sidebar-logo-name {
//           font-size: 16px; font-weight: 800; color: var(--text);
//           letter-spacing: -0.01em;
//         }

//         .sidebar-logo-ver { 
//           font-size: 9px; font-weight: 700; color: var(--brand); 
//           letter-spacing: 0.1em;
//         }

//         .nav-section-label {
//           font-size: 10px; font-weight: 800;
//           text-transform: uppercase; letter-spacing: 0.12em;
//           color: var(--text-3); padding: 0 12px; margin-bottom: 8px;
//         }

//         .nav-item {
//           display: flex; align-items: center; gap: 12px;
//           padding: 10px 14px; border-radius: var(--r-md);
//           color: var(--text-2); font-size: 14px; font-weight: 500;
//           text-decoration: none; cursor: pointer; border: none;
//           background: none; width: 100%; text-align: left;
//           margin-bottom: 2px; transition: all 0.1s ease;
//         }

//         .nav-item:hover { 
//           background: var(--surface-2); 
//           color: var(--text);
//         }

//         .nav-item-active {
//           background: white !important;
//           color: var(--brand) !important;
//           box-shadow: 0 2px 4px rgba(0,0,0,0.05);
//           border: 1px solid var(--border);
//           font-weight: 600;
//         }

//         .nav-children { 
//           padding-left: 20px; 
//           margin: 4px 0 12px 22px;
//           border-left: 1px solid var(--border);
//         }

//         .nav-child { 
//           padding: 8px 14px !important; 
//           font-size: 13px !important; 
//           color: var(--text-2);
//         }

//         .nav-child:hover { color: var(--brand); }

//         .nav-child-dot {
//           width: 5px; height: 5px; border-radius: 50%;
//           background: currentColor; opacity: 0.4; flex-shrink: 0;
//         }

//         .sidebar-bottom {
//           border-top: 1px solid var(--border);
//           padding-top: 16px; margin-top: auto;
//         }

//         .sidebar-version {
//           font-size: 11px; color: var(--text-3);
//           text-align: center; padding: 12px;
//         }

//         /* Responsive Mobile Header */
//         .sidebar-mobile-header {
//            display: none;
//            position: fixed; top: 0; left: 0; right: 0;
//            height: 60px; background: white;
//            border-bottom: 1px solid var(--border);
//            z-index: 45; align-items: center; padding: 0 16px;
//         }

//         .sidebar-mobile-toggle {
//           display: none;
//           background: var(--surface-2); border: 1px solid var(--border);
//           border-radius: var(--r-sm); width: 36px; height: 36px;
//           color: var(--text); cursor: pointer;
//           align-items: center; justify-content: center;
//         }

//         @media (max-width: 1024px) {
//           .sidebar-desktop { display: none !important; }
//           .sidebar-mobile-header { display: flex !important; }
//           .sidebar-mobile-toggle { display: flex !important; }
//           body { padding-top: 60px; }
//         }

//         .sidebar-mobile {
//           position: fixed; top: 0; left: 0; bottom: 0;
//           width: 280px; background: var(--surface);
//           z-index: 50; overflow-y: auto;
//           box-shadow: 10px 0 30px rgba(0,0,0,0.1);
//           animation: slideRight 0.3s cubic-bezier(0.16, 1, 0.3, 1);
//         }

//         @keyframes slideRight {
//           from { transform: translateX(-100%); }
//           to { transform: translateX(0); }
//         }
//       `}</style>

//       {/* Desktop Navigation */}
//       <aside className="sidebar-desktop">{sidebarContent}</aside>

//       {/* Mobile Sticky Header */}
//       <div className="sidebar-mobile-header">
//         <button className="sidebar-mobile-toggle" onClick={() => setMobileOpen(true)}>
//           <Menu size={20} />
//         </button>
//         <div style={{ marginLeft: '12px', fontWeight: 700, color: 'var(--text)' }}>
//           Dairy ERP
//         </div>
//       </div>

//       {/* Mobile Sidebar Drawer */}
//       {mobileOpen && (
//         <>
//           <div className="sidebar-backdrop" 
//                style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 49}} 
//                onClick={() => setMobileOpen(false)} 
//           />
//           <aside className="sidebar-mobile">
//             <button className="sidebar-close-btn" 
//                     style={{position: 'absolute', top: 20, right: 16, background: '#e2e8f0', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer'}}
//                     onClick={() => setMobileOpen(false)}>
//               <X size={20} />
//             </button>
//             {sidebarContent}
//           </aside>
//         </>
//       )}
//     </>
//   )
// }
  