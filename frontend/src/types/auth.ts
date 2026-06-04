export type LoginCompany = {
  co_id: number
  company_cd: string
  company_nm: string
}

export type CompanyMaster = {
  co_id: number
  company_cd: string
  company_nm: string
  created_at?: string | null
  updated_at?: string | null
}

export type CompanyMasterCreatePayload = {
  company_cd: string
  company_nm: string
}

export type CompanyMasterUpdatePayload = {
  company_cd?: string
  company_nm?: string
}

export type UserSession = {
  user_id: number
  user_cd: string
  user_nm: string
  co_id: number
  company_cd: string
  company_nm: string
}

export type LoginResponse = {
  access_token: string
  token_type: string
  user: UserSession
}

export type UserMaster = {
  user_id: number
  co_id: number
  company_cd: string
  company_nm: string
  user_cd: string
  user_nm: string
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export type UserMasterCreatePayload = {
  company_cd: string
  user_cd: string
  user_nm: string
  password: string
  is_active?: boolean
}

export type UserMasterUpdatePayload = {
  user_nm?: string
  password?: string
  is_active?: boolean
}
