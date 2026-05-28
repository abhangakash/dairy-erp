'use client';

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Milk, Lock, Mail, AlertCircle, Loader2, ChevronRight, ShieldCheck } from 'lucide-react'

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
    <div className="system-root">
      <style>{`
        :root { 
          --primary: #2563eb;
          --primary-hover: #1d4ed8;
          --bg-dark: #f1f5f9;
          --card-bg: #ffffff;
          --border: #e2e8f0;
        }

        .system-root {
          display: flex;
          min-height: 100vh;
          background-color: var(--bg-dark);
          background-image: 
            radial-gradient(circle at 0% 0%, rgba(37, 99, 235, 0.05) 0%, transparent 40%),
            radial-gradient(circle at 100% 100%, rgba(37, 99, 235, 0.03) 0%, transparent 40%);
          color: #0f172a;
          font-family: 'DM Sans', -apple-system, sans-serif;
          overflow: hidden;
        }

        .side-branding {
          display: none;
          flex: 1.4;
          position: relative;
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
          border-right: 1px solid var(--border);
          padding: 80px;
          flex-direction: column;
          justify-content: space-between;
        }

        .visual-grid {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px);
          background-size: 50px 50px;
          mask-image: radial-gradient(circle at center, black, transparent 80%);
          opacity: 0.4;
        }

        .login-section {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          z-index: 10;
        }

        .login-card {
          width: 100%;
          max-width: 420px;
          animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .input-wrapper {
          margin-bottom: 20px;
        }

        /* The Fix: Relative container for icons to ignore label height */
        .field-container {
          position: relative;
          display: flex;
          align-items: center;
        }

        .label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .input-field {
          width: 100%;
          height: 58px;
          background: #ffffff;
          border: 1px solid var(--border);
          border-radius: 10px;
          color: #0f172a;
          padding: 0 16px 0 52px;
          font-size: 16px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          outline: none;
        }

        .input-field:focus {
          border-color: var(--primary);
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.18);
        }

        /* Updated Icon Positioning: Vertically Centered within the input height */
        .field-icon {
          position: absolute;
          left: 18px;
          color: #94a3b8;
          transition: color 0.2s;
          pointer-events: none;
        }

        .input-wrapper:focus-within .field-icon {
          color: var(--primary);
        }

        .eye-button {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 8px;
          transition: color 0.2s;
        }

        .eye-button:hover {
          color: var(--primary);
        }

        .login-btn {
          width: 100%;
          height: 58px;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 17px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-top: 32px;
          transition: all 0.2s;
          box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.18);
        }

        .login-btn:hover {
          background: var(--primary-hover);
          transform: translateY(-1px);
        }

        .login-btn:active {
          transform: translateY(1px) scale(0.99);
        }

        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        @media (min-width: 1024px) {
          .side-branding { display: flex; }
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: #dcfce7;
          color: #15803d;
          border-radius: 100px;
          font-size: 12px;
          font-weight: 600;
        }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Side Branding */}
      <div className="side-branding">
        <div className="visual-grid" />
        <div style={{position: 'relative'}}>
          <div className="status-pill">
            <ShieldCheck size={14} /> System Secure
          </div>
          <h1 style={{fontFamily: "'Syne', sans-serif", fontSize: '56px', fontWeight: 900, marginTop: '24px', lineHeight: 1.1, letterSpacing: '-0.03em'}}>
            Next-Gen <br /><span style={{color: 'var(--primary)'}}>Intelligence.</span>
          </h1>
          <p style={{color: '#64748b', fontSize: '20px', marginTop: '24px', maxWidth: '440px', lineHeight: 1.5}}>
            Monitor production cycles, manage cold-chain logistics, and automate distribution in one unified interface.
          </p>
        </div>
        <div style={{color: '#64748b', fontSize: '14px', position: 'relative'}}>
          <p>Trusted.</p>
        </div>
      </div>

      {/* Login Section */}
      <section className="login-section">
        <div className="login-card">
          <header style={{ marginBottom: '40px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginBottom: '40px',
              }}
            >
              <div
                style={{
                  width: '88px',
                  height: '88px',
                  background: '#ffffff',
                  border: '1px solid var(--border)',
                  borderRadius: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                <img
                  src="/logo.png"
                  alt="MilkyFeast Logo"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                  }}
                />
              </div>

              <span
                style={{
                  fontSize: '26px',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                }}
              >
                MILKY<span style={{ color: '#64748b' }}>FEAST</span>
              </span>
            </div>

            <h2
              style={{
                fontSize: '32px',
                fontWeight: 800,
                marginBottom: '8px',
              }}
            >
              System Access
            </h2>

            <p style={{ color: '#334155', fontWeight: 500 }}>
              Enterprise login for authorized personnel.
            </p>
          </header>

          <form onSubmit={handleLogin}>
            <div className="input-wrapper">
              <label className="label">Identity</label>
              <div className="field-container">
                <Mail className="field-icon" size={20} />
                <input 
                  type="email" 
                  className="input-field" 
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className="input-wrapper">
              <label className="label">Security Key</label>
              <div className="field-container">
                <Lock className="field-icon" size={20} />
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  className="input-field" 
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required 
                />
                <button 
                  type="button" 
                  className="eye-button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{display: 'flex', gap: '10px', padding: '16px', background: '#fee2e2', color: '#b91c1c', borderRadius: '10px', fontSize: '14px', border: '1px solid var(--border)'}}>
                <AlertCircle size={18} /> {error}
              </div>
            )}

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? <Loader2 className="spin" size={24} /> : (
                <>Authorize & Enter <ChevronRight size={20} /></>
              )}
            </button>
          </form>

          <footer style={{marginTop: '40px', paddingTop: '32px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b'}}>
            <span>v1.0 (Stable Build)</span>
            <span>&copy; 2026 Next Gen Dev</span>
          </footer>
        </div>
      </section>
    </div>
  )
}