import type { UserMaster } from '../types/auth'

export type EditUserRow = {
  key: string
  user_id: number | null
  company_cd: string
  user_cd: string
  user_nm: string
  password: string
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

let nextKey = 1
export function emptyEditUserRow(defaultCompanyCd = ''): EditUserRow {
  return {
    key: `new-${nextKey++}`,
    user_id: null,
    company_cd: defaultCompanyCd,
    user_cd: '',
    user_nm: '',
    password: '',
    is_active: true,
  }
}

export function isBlankUserRow(row: EditUserRow): boolean {
  return (
    row.user_id == null &&
    !row.company_cd.trim() &&
    !row.user_cd.trim() &&
    !row.user_nm.trim() &&
    !row.password.trim()
  )
}

export function isActiveUserRow(row: EditUserRow): boolean {
  if (row.user_id != null) {
    return Boolean(row.user_cd.trim() && row.user_nm.trim())
  }
  return Boolean(
    row.company_cd.trim() &&
      row.user_cd.trim() &&
      row.user_nm.trim() &&
      row.password.trim()
  )
}

export function listRowsToEditUserRows(rows: UserMaster[]): EditUserRow[] {
  return rows.map((r) => ({
    key: `id-${r.user_id}`,
    user_id: r.user_id,
    company_cd: r.company_cd,
    user_cd: r.user_cd,
    user_nm: r.user_nm,
    password: '',
    is_active: r.is_active,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }))
}

export type UserRowSnapshot = {
  company_cd: string
  user_cd: string
  user_nm: string
  is_active: boolean
}

export function userRowSnapshotsFromEditRows(
  rows: EditUserRow[]
): Map<number, UserRowSnapshot> {
  const map = new Map<number, UserRowSnapshot>()
  for (const row of rows) {
    if (row.user_id == null) continue
    map.set(row.user_id, {
      company_cd: row.company_cd.trim(),
      user_cd: row.user_cd.trim(),
      user_nm: row.user_nm.trim(),
      is_active: row.is_active,
    })
  }
  return map
}

export function buildUserCreatePayload(row: EditUserRow) {
  return {
    company_cd: row.company_cd.trim(),
    user_cd: row.user_cd.trim(),
    user_nm: row.user_nm.trim(),
    password: row.password,
    is_active: row.is_active,
  }
}

export function buildUserUpdatePayload(
  row: EditUserRow,
  snapshot: UserRowSnapshot | undefined
): import('../types/auth').UserMasterUpdatePayload | null {
  const user_nm = row.user_nm.trim()
  if (row.user_id == null) return null
  const patch: import('../types/auth').UserMasterUpdatePayload = {}
  let changed = false
  if (snapshot && user_nm !== snapshot.user_nm) {
    patch.user_nm = user_nm
    changed = true
  } else if (!snapshot) {
    patch.user_nm = user_nm
    changed = true
  }
  if (snapshot && row.is_active !== snapshot.is_active) {
    patch.is_active = row.is_active
    changed = true
  } else if (!snapshot) {
    patch.is_active = row.is_active
    changed = true
  }
  if (row.password.trim()) {
    patch.password = row.password
    changed = true
  }
  return changed ? patch : null
}

export function userRowChanged(
  row: EditUserRow,
  snapshot: UserRowSnapshot | undefined
): boolean {
  if (row.user_id == null) return isActiveUserRow(row)
  if (!snapshot) return false
  return (
    row.user_nm.trim() !== snapshot.user_nm ||
    row.is_active !== snapshot.is_active ||
    Boolean(row.password.trim())
  )
}
