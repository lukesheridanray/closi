export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  role: string
  avatar_url: string | null
  is_active: boolean
  organization_id: string
}

export interface EntityLabels {
  singular: string
  plural: string
}

export interface OrgSettings {
  entity_labels?: {
    deal?: EntityLabels
  }
}

export interface Organization {
  id: string
  name: string
  slug: string
  email: string | null
  phone: string | null
  address_line1: string | null
  city: string | null
  state: string | null
  zip: string | null
  logo_url: string | null
  timezone: string
  currency: string
  plan: string
  settings: OrgSettings | null
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
  organization: Organization
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  first_name: string
  last_name: string
  email: string
  password: string
}

export interface CompanyDetailsRequest {
  name: string
  phone?: string | null
  address_line1?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  timezone?: string
}
