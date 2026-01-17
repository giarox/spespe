import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const isTestEnv = process.env.NODE_ENV === 'test'

const createMockSupabase = () => ({
  from: () => ({
    select: () => ({
      order: () => ({
        order: () => ({
          range: () => ({ data: [], error: null })
        })
      })
    }),
    insert: () => ({
      select: () => ({
        single: () => ({ data: null, error: null })
      })
    }),
    upsert: () => ({
      select: () => ({
        single: () => ({ data: null, error: null })
      })
    }),
    delete: () => ({
      eq: () => ({ data: null, error: null })
    }),
    update: () => ({
      eq: () => ({ data: null, error: null })
    })
  }),
  rpc: () => ({
    range: () => ({ data: [], error: null })
  })
})

let supabase

if (!supabaseUrl || !supabaseAnonKey) {
  if (isTestEnv) {
    supabase = createMockSupabase()
  } else {
    throw new Error('Missing Supabase environment variables. Check .env.local file.')
  }
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey)
}

export { supabase }
