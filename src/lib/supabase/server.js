import { createClient } from '@supabase/supabase-js'

// Use this ONLY in server actions / API routes — never expose to browser
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)