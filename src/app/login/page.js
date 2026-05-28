'use client';

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Lock, Mail, AlertCircle, Loader2, ChevronRight, ShieldCheck } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError) {
      setError('Invalid email or password.')
      setLoading(false)
      return
    }

    toast.success('Access Granted')
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="studio-canvas">
      <style>{`
        :root { 
          --accent-blue: #2563eb;
          --canvas-bg: #fcfcfc;
          --ink-primary: #121214;
          --ink-muted: #71717a;
          --structural-line: #e4e4e7;
          --font-display: 'Syne', sans-serif;
          --font-sans: 'DM Sans', sans-serif;
        }

        /* Lock canvas to viewport bounds to guarantee zero mobile scrolling */
        .studio-canvas {
          height: 100vh;
          height: 100dvh;
          background-color: var(--canvas-bg);
          color: var(--ink-primary);
          font-family: var(--font-sans);
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 24px;
          box-sizing: border-box;
          overflow: hidden;
        }

        @media (min-width: 768px) {
          .studio-canvas {
            padding: 40px;
          }
        }

        /* Fixed desktop layout separator line */
        .axis-v {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 45%;
          width: 1px;
          background-color: var(--structural-line);
          pointer-events: none;
          display: none;
        }

        @media (min-width: 1024px) {
          .axis-v { display: block; }
        }

        /* Static Layout Header */
        .top-navigation {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--structural-line);
          padding-bottom: 16px;
          z-index: 10;
          flex-shrink: 0;
        }

        @media (min-width: 768px) {
          .top-navigation {
            padding-bottom: 24px;
          }
        }

        .brand-cluster {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-mark-frame {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--structural-line);
          border-radius: 8px;
          background: #ffffff;
          padding: 4px;
        }

        .brand-mark-frame img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .brand-string-logo {
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 800;
          letter-spacing: -0.02em;
          text-transform: uppercase;
        }

        @media (min-width: 768px) {
          .brand-string-logo {
            font-size: 16px;
          }
        }

        .system-ticker {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink-muted);
        }

        /* Main Workspace Container */
        .workspace-layout {
          display: flex;
          flex-direction: column;
          justify-content: center;
          flex: 1;
          position: relative;
          z-index: 5;
          width: 100%;
          min-height: 0;
          overflow: hidden;
        }

        @media (min-width: 1024px) {
          .workspace-layout {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            gap: 60px;
          }
        }

        /* Hide full marketing copy text blocks completely on mobile devices */
        .editorial-block {
          display: none;
          width: 100%;
          max-width: 440px;
        }

        @media (min-width: 1024px) {
          .editorial-block {
            display: block;
          }
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: #dcfce7;
          color: #15803d;
          border-radius: 100px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          margin-bottom: 20px;
        }

        .monumental-header {
          font-family: var(--font-display);
          font-size: clamp(34px, 4vw, 52px);
          font-weight: 900;
          line-height: 1.1;
          letter-spacing: -0.04em;
          margin-bottom: 24px;
        }

        .editorial-subtext {
          font-size: 15px;
          line-height: 1.6;
          color: var(--ink-muted);
        }

        /* Interaction form section configurations */
        .interactive-form-column {
          width: 100%;
          max-width: 440px;
          margin: 0 auto;
        }

        @media (min-width: 1024px) {
          .interactive-form-column {
            margin: 0;
          }
        }

        .form-heading-context {
          margin-bottom: 24px;
        }

        @media (min-width: 768px) {
          .form-heading-context {
            margin-bottom: 32px;
          }
        }

        .form-title {
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin-bottom: 4px;
        }

        @media (min-width: 768px) {
          .form-title {
            font-size: 24px;
          }
        }

        .form-subtitle {
          font-size: 13px;
          color: var(--ink-muted);
          font-weight: 500;
        }

        /* Micro-styled system modular input boundaries */
        .entry-row {
          position: relative;
          border-bottom: 1px solid var(--structural-line);
          padding: 12px 0 6px 0;
          margin-bottom: 20px;
          transition: border-color 0.3s ease;
        }

        @media (min-width: 768px) {
          .entry-row {
            padding: 16px 0 8px 0;
            margin-bottom: 24px;
          }
        }

        .entry-row:focus-within {
          border-color: var(--ink-primary);
        }

        .row-meta-label {
          display: block;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--ink-muted);
          margin-bottom: 4px;
        }

        .field-container {
          position: relative;
          display: flex;
          align-items: center;
        }

        .field-icon {
          position: absolute;
          left: 0;
          color: #94a3b8;
          transition: color 0.2s;
          pointer-events: none;
        }

        .entry-row:focus-within .field-icon {
          color: var(--accent-blue);
        }

        .naked-input {
          width: 100%;
          height: 36px;
          background: transparent;
          border: none;
          font-size: 15px;
          font-weight: 500;
          color: var(--ink-primary);
          outline: none;
          padding-left: 28px;
          padding-right: 40px;
        }

        @media (min-width: 768px) {
          .naked-input {
            height: 38px;
            font-size: 16px;
            padding-left: 32px;
          }
        }

        .row-action-btn {
          position: absolute;
          right: 0;
          background: none;
          border: none;
          padding: 6px;
          color: var(--ink-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
        }

        .row-action-btn:hover {
          color: var(--ink-primary);
        }

        /* Minimal high-performance submit triggers */
        .minimal-submit-trigger {
          width: 100%;
          height: 50px;
          background: var(--ink-primary);
          color: #ffffff;
          border: none;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-top: 24px;
          transition: background-color 0.2s ease, transform 0.1s;
        }

        @media (min-width: 768px) {
          .minimal-submit-trigger {
            height: 52px;
            margin-top: 36px;
          }
        }

        .minimal-submit-trigger:hover:not(:disabled) {
          background-color: var(--accent-blue);
        }

        .minimal-submit-trigger:active:not(:disabled) {
          transform: translateY(1px);
        }

        .minimal-submit-trigger:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .inline-alert-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 0;
          color: #ef4444;
          font-size: 12px;
          font-weight: 600;
          border-bottom: 1px solid #fee2e2;
          margin-bottom: 12px;
        }

        /* Fixed Footer Tickers */
        .system-footer-bar {
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 10px;
          font-weight: 700;
          color: var(--ink-muted);
          letter-spacing: 0.05em;
          border-top: 1px solid var(--structural-line);
          padding-top: 16px;
          z-index: 10;
          flex-shrink: 0;
        }

        @media (min-width: 640px) {
          .system-footer-bar {
            flex-direction: row;
            justify-content: space-between;
            font-size: 11px;
            padding-top: 24px;
          }
        }

        .spin-element { animation: continuous-rotation 0.8s linear infinite; }
        @keyframes continuous-rotation { to { transform: rotate(360deg); } }
      `}</style>

      <div className="axis-v" />

      {/* Corporate Global Navigation Block */}
      <header className="top-navigation">
        <div className="brand-cluster">
          <div className="brand-mark-frame">
            <img src="/logo.png" alt="MilkyFeast Logo" />
          </div>
          <span className="brand-string-logo">
            MILKY<span style={{ color: 'var(--accent-blue)' }}>FEAST</span>
          </span>
        </div>
      </header>

      {/* Primary Interaction Interface Area */}
      <main className="workspace-layout">
        
        {/* Rendered only on Desktop Screens (min-width: 1024px) */}
        <div className="editorial-block">
          <div className="status-pill">
            <ShieldCheck size={13} /> System Secure
          </div>
          <h1 className="monumental-header">
            Next-Gen <br />
            <span style={{ color: 'var(--accent-blue)' }}>Intelligence.</span>
          </h1>
          <p className="editorial-subtext">
            Monitor production cycles, manage cold-chain logistics, and automate distribution in one unified interface.
          </p>
        </div>

        {/* Instantly Visible on Device Load (Zero Scroll Overrides) */}
        <div className="interactive-form-column">
          <div className="form-heading-context">
            <h2 className="form-title">System Access</h2>
            <p className="form-subtitle">Enterprise login for authorized personnel.</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="entry-row">
              <label className="row-meta-label">Identity</label>
              <div className="field-container">
                <Mail className="field-icon" size={16} />
                <input 
                  type="email" 
                  className="naked-input" 
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className="entry-row">
              <label className="row-meta-label">Security Key</label>
              <div className="field-container">
                <Lock className="field-icon" size={16} />
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  className="naked-input" 
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required 
                />
                <button 
                  type="button" 
                  className="row-action-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="inline-alert-banner">
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="minimal-submit-trigger" disabled={loading}>
              {loading ? (
                <Loader2 className="spin-element" size={18} />
              ) : (
                <>
                  Authorize & Enter <ChevronRight size={14} />
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      {/* Structural Metadata System Footer */}
      <footer className="system-footer-bar">
        <div style={{ display: 'flex', gap: '16px' }}>
          <span>v1.0 (Stable Build)</span>
          <span>&copy; 2026 Next Gen Dev</span>
        </div>
      </footer>
    </div>
  )
}