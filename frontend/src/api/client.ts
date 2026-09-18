import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

export const ACCESS_KEY = 'sgic_access'
export const REFRESH_KEY = 'sgic_refresh'

export const api = axios.create({ baseURL: BASE_URL })

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(ACCESS_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let refreshing: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refresh = localStorage.getItem(REFRESH_KEY)
  if (!refresh) return null
  try {
    const { data } = await axios.post(`${BASE_URL}/auth/token/refresh/`, { refresh })
    localStorage.setItem(ACCESS_KEY, data.access)
    if (data.refresh) localStorage.setItem(REFRESH_KEY, data.refresh)
    return data.access as string
  } catch {
    return null
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true
      if (!refreshing) refreshing = refreshAccessToken()
      const token = await refreshing
      refreshing = null
      if (token) {
        original.headers = original.headers ?? {}
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      }
      localStorage.removeItem(ACCESS_KEY)
      localStorage.removeItem(REFRESH_KEY)
    }
    return Promise.reject(error)
  },
)

export function extraerError(error: unknown): string {
  const err = error as AxiosError<any>
  const data = err?.response?.data
  if (!data) return err?.message ?? 'Error inesperado'
  if (typeof data === 'string') return data
  if (data.detail) return String(data.detail)
  const partes: string[] = []
  for (const [campo, valor] of Object.entries(data)) {
    const texto = Array.isArray(valor) ? valor.join(' ') : String(valor)
    partes.push(`${campo}: ${texto}`)
  }
  return partes.join(' | ') || 'Error inesperado'
}