import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Sidebar from '@/components/ui/Sidebar'
import Header from '@/components/ui/Header'

export default async function DashboardLayout({ children }) {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {},
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  return (
    <div className="dashboard-shell">
      <Sidebar />

      <div className="dashboard-main">
        <Header user={profile} />

        <main className="dashboard-content">
          {children}
        </main>
      </div>

      <style>{`
        .dashboard-shell {
          display: flex;
          min-height: 100vh;
          background: var(--bg);
        }

        .dashboard-main {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          margin-left: var(--sidebar-w);
        }

        .dashboard-content {
          flex: 1;
          padding: 28px 32px;
          max-width: 1400px;
          width: 100%;
        }

        @media (max-width: 768px) {
          .dashboard-main {
            margin-left: 0;
          }

          .dashboard-content {
            padding: 20px 16px;
          }
        }
      `}</style>
    </div>
  )
}