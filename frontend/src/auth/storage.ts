import type { UserSession } from '../types/auth'

const STORAGE_KEY = 'hanalite.auth.v1'

export type StoredAuth = {
  access_token: string
  user: UserSession
}

export function readStoredAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredAuth
    if (!parsed?.access_token || !parsed?.user?.user_id) return null
    return parsed
  } catch {
    return null
  }
}

export function writeStoredAuth(auth: StoredAuth): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
}

export function clearStoredAuth(): void {
  localStorage.removeItem(STORAGE_KEY)
}
