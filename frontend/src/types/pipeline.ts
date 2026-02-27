export interface Pipeline {
  id: string
  org_id: string
  name: string
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface PipelineStage {
  id: string
  pipeline_id: string
  name: string
  color: string
  position: number
  is_won: boolean
  is_lost: boolean
  is_active: boolean
  stale_days: number
  created_at: string
}

export interface Contact {
  id: string
  org_id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  company: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  created_at: string
}

export interface Deal {
  id: string
  org_id: string
  pipeline_id: string
  stage_id: string
  contact_id: string
  title: string
  value: number
  probability: number
  expected_close_date: string | null
  source: string
  assigned_to: string | null
  notes: string
  created_at: string
  updated_at: string
}

export interface DealWithContact extends Deal {
  contact: Contact
}

export interface StageHistory {
  id: string
  deal_id: string
  from_stage_id: string | null
  to_stage_id: string
  moved_at: string
  moved_by: string | null
}
