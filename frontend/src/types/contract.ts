export interface Contract {
  id: string
  organization_id: string
  deal_id: string | null
  contact_id: string
  quote_id: string | null
  title: string
  status: ContractStatus
  equipment_total: number
  monthly_amount: number
  term_months: number
  total_value: number
  equipment_lines: EquipmentItem[] | null
  start_date: string | null
  end_date: string | null
  signed_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface EquipmentItem {
  name: string
  quantity: number
}

export interface Payment {
  id: string
  organization_id: string
  contact_id: string
  contract_id: string | null
  subscription_id: string | null
  invoice_id: string | null
  status: PaymentStatus
  amount: number
  amount_refunded: number
  currency: string
  payment_method_type: string | null
  payment_method_last4: string | null
  payment_date: string
  failure_code: string | null
  failure_message: string | null
  created_at: string
}

export type ContractStatus = 'active' | 'pending' | 'expired' | 'cancelled'
export type PaymentStatus = 'succeeded' | 'failed' | 'refunded' | 'pending'

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  active: 'Active',
  pending: 'Pending',
  expired: 'Due for renewal',
  cancelled: 'Cancelled',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  succeeded: 'Succeeded',
  failed: 'Failed',
  refunded: 'Refunded',
  pending: 'Pending',
}

export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'paused' | 'expired'

export interface Subscription {
  id: string
  organization_id: string
  contract_id: string | null
  contact_id: string
  status: SubscriptionStatus
  amount: number
  currency: string
  billing_interval: string
  billing_interval_count: number
  billing_anchor_day: number | null
  current_period_start: string | null
  current_period_end: string | null
  next_billing_date: string | null
  failed_payment_count: number
  last_payment_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  created_at: string
  updated_at: string
}

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: 'Active',
  past_due: 'Past Due',
  cancelled: 'Cancelled',
  paused: 'Paused',
  expired: 'Due for renewal',
}
