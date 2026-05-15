'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from "next/image";
import {
  Milk, Home, ArrowLeft, FlaskConical,
  ShoppingCart, Users, Receipt, Package, LayoutDashboard
} from 'lucide-react'

const QUICK_LINKS = [
  { label: 'Dashboard',     href: '/dashboard',                    icon: LayoutDashboard, color: '#f97316' },
  { label: 'Production',    href: '/dashboard/production',         icon: FlaskConical,    color: '#4ade80' },
  { label: 'Sales',         href: '/dashboard/sales',              icon: ShoppingCart,    color: '#60a5fa' },
  { label: 'Workers',       href: '/dashboard/workers/attendance', icon: Users,           color: '#a78bfa' },
  { label: 'Expenses',      href: '/dashboard/expenses',           icon: Receipt,         color: '#fbbf24' },
  { label: 'Raw Materials', href: '/dashboard/raw-materials',      icon: Package,         color: '#34d399' },
]

export default function NotFound() {
  const router = useRouter()

  return (
    <>
      <style>{`
        .nf-page {
          min-height: 100vh;
          background: var(--bg);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          position: relative;
          overflow: hidden;
          font-family: var(--font-body);
        }

        /* Grid background */
        .nf-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(var(--border) 1px, transparent 1px),
            linear-gradient(90deg, var(--border) 1px, transparent 1px);
          background-size: 44px 44px;
          opacity: 0.25;
          mask-image: radial-gradient(ellipse 70% 70% at 50% 50%, black 20%, transparent 100%);
          -webkit-mask-image: radial-gradient(ellipse 70% 70% at 50% 50%, black 20%, transparent 100%);
          pointer-events: none;
        }

        /* Glow blobs */
        .nf-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          pointer-events: none;
        }
        .nf-blob-1 {
          width: 400px; height: 400px;
          background: rgba(249,115,22,0.12);
          top: -100px; right: -80px;
        }
        .nf-blob-2 {
          width: 300px; height: 300px;
          background: rgba(96,165,250,0.08);
          bottom: -80px; left: -60px;
        }

        /* Container */
        .nf-container {
          position: relative; z-index: 1;
          width: 100%; max-width: 560px;
          display: flex; flex-direction: column;
          align-items: center; gap: 32px;
          text-align: center;
        }

        /* Logo */
        .nf-logo {
          display: flex; align-items: center; gap: 10px;
        }
        .nf-logo-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}
        .nf-logo-name {
          font-family: var(--font-display);
          font-size: 16px; font-weight: 800;
          color: var(--text); letter-spacing: -0.02em;
        }

        /* 404 number block */
        .nf-number-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }

        .nf-digit {
          font-family: var(--font-display);
          font-size: clamp(80px, 18vw, 130px);
          font-weight: 800;
          line-height: 1;
          letter-spacing: -0.04em;
          color: transparent;
          -webkit-text-stroke: 2px rgba(249,115,22,0.55);
          animation: nfPulse 2.4s ease-in-out infinite;
        }
        @keyframes nfPulse {
          0%,100% { -webkit-text-stroke-color: rgba(249,115,22,0.45); }
          50%      { -webkit-text-stroke-color: rgba(249,115,22,0.9); }
        }

        /* Milk bucket (the 0) */
        .nf-bucket-wrap {
          position: relative;
          width: clamp(68px, 14vw, 110px);
          height: clamp(80px, 18vw, 130px);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .nf-bucket-handle {
          position: absolute;
          top: 0; left: 50%;
          transform: translateX(-50%);
          width: 52%; height: 28%;
          border: 2px solid rgba(249,115,22,0.45);
          border-bottom: none;
          border-radius: 40px 40px 0 0;
        }
        .nf-bucket-body {
          position: absolute;
          bottom: 0; left: 10%; right: 10%;
          height: 72%;
          border-radius: 6px 6px 12px 12px;
          background: var(--surface-2);
          border: 2px solid rgba(249,115,22,0.45);
          overflow: hidden;
          display: flex; align-items: flex-end;
        }
        .nf-milk-fill {
          width: 100%;
          background: linear-gradient(to top, rgba(249,115,22,0.35), rgba(249,115,22,0.1));
          animation: nfMilk 2.8s ease-in-out infinite alternate;
          flex-shrink: 0;
        }
        @keyframes nfMilk {
          0%   { height: 40%; }
          100% { height: 62%; }
        }
        .nf-bucket-zero {
          position: relative; z-index: 2;
          font-family: var(--font-display);
          font-size: clamp(32px, 7vw, 52px);
          font-weight: 800;
          color: rgba(249,115,22,0.65);
          letter-spacing: -0.04em;
          user-select: none;
          line-height: 1;
        }

        /* Drip dots */
        .nf-drips {
          display: flex;
          align-items: flex-start;
          justify-content: center;
          gap: 10px;
          margin-top: -8px;
        }
        .nf-drip {
          border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
          background: rgba(249,115,22,0.3);
          animation: nfDrip 2s ease-in-out infinite;
        }
        .nf-drip-1 { width: 9px;  height: 13px; animation-delay: 0s;    }
        .nf-drip-2 { width: 13px; height: 17px; animation-delay: 0.35s; }
        .nf-drip-3 { width: 8px;  height: 11px; animation-delay: 0.7s;  }
        @keyframes nfDrip {
          0%,100% { transform: scaleY(1);   opacity: 0.5; }
          50%      { transform: scaleY(1.2); opacity: 1;   }
        }

        /* Message */
        .nf-title {
          font-family: var(--font-display);
          font-size: clamp(18px, 4vw, 24px);
          font-weight: 700; color: var(--text);
          letter-spacing: -0.02em; margin: 0;
        }
        .nf-sub {
          font-size: 14px; color: var(--text-2);
          line-height: 1.7; margin: 0; margin-top: 8px;
        }

        /* Action buttons */
        .nf-actions {
          display: flex; gap: 12px;
          flex-wrap: wrap; justify-content: center;
          width: 100%;
        }
        .nf-btn-back {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 11px 22px; border-radius: var(--r-md);
          background: var(--surface-2); border: 1px solid var(--border);
          color: var(--text-2); font-size: 14px; font-weight: 500;
          font-family: var(--font-body); cursor: pointer;
          transition: all 0.15s; text-decoration: none; flex-shrink: 0;
        }
        .nf-btn-back:hover {
          background: var(--surface-3); color: var(--text);
          border-color: var(--border-2);
        }
        .nf-btn-home {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 11px 22px; border-radius: var(--r-md);
          background: var(--brand); color: #fff;
          font-size: 14px; font-weight: 600;
          font-family: var(--font-body); text-decoration: none;
          transition: all 0.15s; flex-shrink: 0;
          border: none; cursor: pointer;
        }
        .nf-btn-home:hover {
          background: var(--brand-dim);
          box-shadow: 0 0 20px rgba(249,115,22,0.3);
          transform: translateY(-1px);
        }

        /* Quick links */
        .nf-ql-title {
          font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.08em; color: var(--text-3); margin-bottom: 12px;
        }
        .nf-ql-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px; width: 100%;
        }
        .nf-ql-card {
          display: flex; flex-direction: column;
          align-items: center; gap: 8px;
          padding: 16px 10px; border-radius: var(--r-md);
          background: var(--surface); border: 1px solid var(--border);
          text-decoration: none; transition: all 0.15s; cursor: pointer;
        }
        .nf-ql-card:hover {
          background: var(--surface-2); border-color: var(--border-2);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.15);
        }
        .nf-ql-icon {
          width: 38px; height: 38px; border-radius: var(--r-sm);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .nf-ql-label {
          font-size: 12px; font-weight: 500;
          color: var(--text-2); text-align: center;
          line-height: 1.3;
        }

        /* Divider */
        .nf-divider {
          width: 100%; height: 1px;
          background: var(--border); margin: 0;
        }

        /* Responsive */
        @media (max-width: 480px) {
          .nf-ql-grid { grid-template-columns: repeat(2, 1fr); }
          .nf-actions { flex-direction: column; }
          .nf-btn-back, .nf-btn-home { justify-content: center; width: 100%; }
        }
      `}</style>

      <div className="nf-page">
        <div className="nf-grid" />
        <div className="nf-blob nf-blob-1" />
        <div className="nf-blob nf-blob-2" />

        <div className="nf-container">

          {/* Logo */}
          <div className="nf-logo">
  <div className="nf-logo-icon">
    <Image
      src="/logo.png"
      alt="Milky Feast Logo"
      width={100}
      height={100}
      priority
    />
  </div>

  <span className="nf-logo-name">Milky Feast</span>
</div>

          {/* 404 + drips */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
            <div className="nf-number-row">
              <span className="nf-digit">4</span>

              {/* Milk bucket 0 */}
              <div className="nf-bucket-wrap">
                <div className="nf-bucket-handle" />
                <div className="nf-bucket-body">
                  <div className="nf-milk-fill" />
                </div>
                <span className="nf-bucket-zero">0</span>
              </div>

              <span className="nf-digit">4</span>
            </div>

            {/* Drip drops */}
            <div className="nf-drips">
              <div className="nf-drip nf-drip-1" />
              <div className="nf-drip nf-drip-2" />
              <div className="nf-drip nf-drip-3" />
            </div>
          </div>

          {/* Message */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h1 className="nf-title">Oops! This page spilled.</h1>
            <p className="nf-sub">
              The page you are looking for does not exist or has been moved.
              Your dairy data is safe and untouched.
            </p>
          </div>

          {/* Buttons */}
          <div className="nf-actions">
            <button className="nf-btn-back" onClick={() => router.back()}>
              <ArrowLeft size={15} />
              Go Back
            </button>
            <Link href="/dashboard" className="nf-btn-home">
              <Home size={15} />
              Go to Dashboard
            </Link>
          </div>

          <div className="nf-divider" />

          {/* Quick links */}
          <div style={{ width: '100%' }}>
            <div className="nf-ql-title">Or jump to</div>
            <div className="nf-ql-grid">
              {QUICK_LINKS.map(link => (
                <Link key={link.href} href={link.href} className="nf-ql-card">
                  <div
                    className="nf-ql-icon"
                    style={{
                      background: link.color + '18',
                      border:     `1px solid ${link.color}30`,
                    }}
                  >
                    <link.icon size={17} color={link.color} strokeWidth={1.8} />
                  </div>
                  <span className="nf-ql-label">{link.label}</span>
                </Link>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  )
}