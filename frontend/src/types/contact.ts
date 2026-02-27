export interface Contact {
  id: string
  organization_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  company: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  lead_source: LeadSource
  status: ContactStatus
  property_type: PropertyType | null
  assigned_to: string | null
  tags: string[]
  notes: string | null
  created_at: string
  updated_at: string
}

export type LeadSource =
  | 'google_ads'
  | 'referral'
  | 'website'
  | 'cold_call'
  | 'door_knock'
  | 'partner'
  | 'facebook'
  | 'walk_in'
  | 'other'

export type ContactStatus =
  | 'new'
  | 'active'
  | 'customer'
  | 'inactive'
  | 'lost'

export type PropertyType =
  | 'single_family'
  | 'condo'
  | 'townhouse'
  | 'apartment'
  | 'commercial'
  | 'other'

export interface Activity {
  id: string
  organization_id: string
  contact_id: string
  deal_id: string | null
  type: ActivityType
  subject: string
  description: string | null
  performed_by: string | null
  performed_at: string
  created_at: string
}

export type ActivityType =
  | 'note'
  | 'call'
  | 'email'
  | 'meeting'
  | 'site_visit'
  | 'task_created'
  | 'task_completed'
  | 'deal_created'
  | 'stage_change'
  | 'quote_sent'

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  google_ads: 'Google Ads',
  referral: 'Referral',
  website: 'Website',
  cold_call: 'Cold Call',
  door_knock: 'Door Knock',
  partner: 'Partner',
  facebook: 'Facebook',
  walk_in: 'Walk-In',
  other: 'Other',
}

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  new: 'New',
  active: 'Active',
  customer: 'Customer',
  inactive: 'Inactive',
  lost: 'Lost',
}

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  single_family: 'Single Family',
  condo: 'Condo',
  townhouse: 'Townhouse',
  apartment: 'Apartment',
  commercial: 'Commercial',
  other: 'Other',
}

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  note: 'Note',
  call: 'Phone Call',
  email: 'Email',
  meeting: 'Meeting',
  site_visit: 'Site Visit',
  task_created: 'Task Created',
  task_completed: 'Task Completed',
  deal_created: 'Deal Created',
  stage_change: 'Stage Change',
  quote_sent: 'Quote Sent',
}
