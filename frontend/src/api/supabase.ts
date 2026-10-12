import { createClient } from '@supabase/supabase-js'

/**
 * Configuración PUBLICA del proyecto SGIC-Terneros Producción.
 *
 * La URL y sb_publishable_ son identificadores para el navegador, NO secretos.
 * En producción se fijan al nuevo proyecto para evitar que las variables antiguas
 * de Cloudflare Pages redirijan el sitio al proyecto de demostración.
 *
 * Los modos de desarrollo locales siguen usando VITE_* en .env.local.
 * NUNCA incluir service_role, sb_secret_ ni contraseñas en el frontend.
 */
const productionProject = {
  url: 'https://mtecrgoyrfclnlctenss.supabase.co',
  publishableKey: 'sb_publishable_A8JQiZ5KomDjSoPhtIuUVA_7-mJdUyw',
} as const

const production = import.meta.env.PROD

export const usaSupabase = production || import.meta.env.VITE_AUTH_PROVIDER === 'supabase'

const url = production ? productionProject.url : import.meta.env.VITE_SUPABASE_URL?.trim()
const publishableKey = production
  ? productionProject.publishableKey
  : import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

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
