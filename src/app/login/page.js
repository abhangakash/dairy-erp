'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Milk, Lock, Mail, AlertCircle } from 'lucide-react'

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
      setError('Invalid email or password. Please try again.')
      setLoading(false)
      return
    }

    toast.success('Welcome back!')
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="login-page">
      {/* Background decoration */}
      <div className="login-bg">
        <div className="login-blob login-blob-1" />
        <div className="login-blob login-blob-2" />
        <div className="login-grid" />
      </div>

      {/* Card */}
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <Milk size={26} color="#f97316" strokeWidth={1.8} />
          </div>
          <div>
            <div className="login-logo-title">Dairy ERP</div>
            <div className="login-logo-sub">Management System</div>
          </div>
        </div>

        <div className="login-divider" />

        <h1 className="login-heading">Sign in</h1>
        <p className="login-subheading">Enter your credentials to access the dashboard</p>

        <form onSubmit={handleLogin} style={{ marginTop: 28 }}>
          {/* Email */}
          <div className="form-group">
            <label className="label">Email address</label>
            <div className="input-icon-wrap">
              <Mail size={15} className="input-icon" />
              <input
                type="email"
                className="input input-with-icon"
                placeholder="admin@dairy.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="label">Password</label>
            <div className="input-icon-wrap">
              <Lock size={15} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                className="input input-with-icon input-with-icon-right"
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="input-icon-btn"
                onClick={() => setShowPassword(v => !v)}
                tabIndex={-1}
              >
                {showPassword
                  ? <EyeOff size={15} />
                  : <Eye size={15} />
                }
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="login-error">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-primary w-full login-btn"
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            {loading ? (
              <>
                <span className="login-spinner" />
                Signing in…
              </>
            ) : (
              'Sign in to Dashboard'
            )}
          </button>
        </form>

        <div className="login-footer">
          <Lock size={12} />
          Secure internal system — authorised access only
        </div>
      </div>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          position: relative;
          overflow: hidden;
          background: var(--bg);
        }

        /* Background */
        .login-bg { position: absolute; inset: 0; pointer-events: none; }

        .login-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.18;
        }
        .login-blob-1 {
          width: 500px; height: 500px;
          background: var(--brand);
          top: -120px; right: -100px;
        }
        .login-blob-2 {
          width: 400px; height: 400px;
          background: #7c3aed;
          bottom: -100px; left: -80px;
        }

        .login-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(var(--border) 1px, transparent 1px),
            linear-gradient(90deg, var(--border) 1px, transparent 1px);
          background-size: 40px 40px;
          opacity: 0.25;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%);
        }

        /* Card */
        .login-card {
          position: relative;
          width: 100%;
          max-width: 420px;
          background: var(--surface);
          border: 1px solid var(--border-2);
          border-radius: var(--r-xl);
          padding: 36px;
          box-shadow:
            0 0 0 1px rgba(249,115,22,0.08),
            0 24px 60px rgba(0,0,0,0.5),
            0 0 80px rgba(249,115,22,0.06);
          animation: slideUp 0.3s ease;
        }

        /* Logo */
        .login-logo {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 24px;
        }
        .login-logo-icon {
          width: 48px; height: 48px;
          background: var(--brand-glow);
          border: 1px solid rgba(249,115,22,0.3);
          border-radius: var(--r-md);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .login-logo-title {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 800;
          color: var(--text);
          letter-spacing: -0.02em;
        }
        .login-logo-sub {
          font-size: 12px;
          color: var(--text-3);
          margin-top: 1px;
        }

        .login-divider {
          height: 1px;
          background: var(--border);
          margin-bottom: 24px;
        }

        .login-heading {
          font-family: var(--font-display);
          font-size: 24px;
          font-weight: 700;
          color: var(--text);
          letter-spacing: -0.02em;
          margin-bottom: 6px;
        }
        .login-subheading {
          font-size: 13px;
          color: var(--text-2);
        }

        /* Input with icon */
        .input-icon-wrap {
          position: relative;
        }
        .input-icon {
          position: absolute;
          left: 13px; top: 50%;
          transform: translateY(-50%);
          color: var(--text-3);
          pointer-events: none;
        }
        .input-with-icon { padding-left: 38px; }
        .input-with-icon-right { padding-right: 42px; }

        .input-icon-btn {
          position: absolute;
          right: 12px; top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-3);
          padding: 2px;
          display: flex;
          align-items: center;
          transition: color 0.15s;
        }
        .input-icon-btn:hover { color: var(--text-2); }

        /* Error */
        .login-error {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--red-dim);
          border: 1px solid rgba(248,113,113,0.25);
          border-radius: var(--r-md);
          padding: 10px 14px;
          color: var(--red);
          font-size: 13px;
          margin-bottom: 14px;
        }

        /* Login button */
        .login-btn {
          height: 46px;
          font-size: 15px;
          font-weight: 600;
          justify-content: center;
          letter-spacing: 0.01em;
        }

        /* Spinner */
        .login-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Footer */
        .login-footer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 24px;
          font-size: 11px;
          color: var(--text-3);
        }
      `}</style>
    </div>
  )
}