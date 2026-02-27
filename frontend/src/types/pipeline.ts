export interface Pipeline {
  id: string
  organization_id: string
  name: string
  is_default: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface PipelineStage {
  id: string
  pipeline_id: string
  organization_id: string
  name: string
  color: string
  sort_order: number
  is_won_stage: boolean
  is_lost_stage: boolean
  is_active: boolean
  stale_days: number | null
  created_at: string
}

export interface PipelineDetail extends Pipeline {
  stages: PipelineStage[]
}

export interface Contact {
  id: string
  organization_id: string
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
  organization_id: string
  pipeline_id: string
  stage_id: string | null
  contact_id: string
  assigned_to: string | null
  title: string
  estimated_value: number
  notes: string | null
  loss_reason: string | null
  expected_close_date: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
}

export interface DealDetail extends Deal {
  contact_name: string | null
  stage_name: string | null
  assigned_user_name: string | null
}

export interface DealWithContact extends Deal {
  contact: Contact
}

export interface StageHistory {
  id: string
  deal_id: string
  from_stage_id: string | null
  to_stage_id: string | null
  moved_at: string
  moved_by: string | null
  created_at: string
}
