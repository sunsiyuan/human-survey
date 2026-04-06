import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

function getSupabaseClient() {
  if (client) {
    return client
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are required.')
  }

  client = createClient(supabaseUrl, supabaseAnonKey)
  return client
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const target = getSupabaseClient()
    const value = Reflect.get(target, property)

    if (typeof value === 'function') {
      return value.bind(target)
    }

    return value
  },
})
