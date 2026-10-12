import { createClient } from '@supabase/supabase-js'

/**
 * Cambiar a Supabase solo cuando su esquema y autenticación estén preparados.
 * No colocar claves secretas / service_role en variables VITE_.
 */
export const usaSupabase = import.meta.env.VITE_AUTH_PROVIDER === 'supabase'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const supabase =
  usaSupabase && url && publishableKey
    ? createClient(url, publishableKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null
