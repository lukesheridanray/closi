export interface Contract {
  id: string
  org_id: string
  deal_id: string
  contact_id: string
  quote_id: string
  title: string
  status: ContractStatus
  equipment_total: number
  monthly_amount: number
  term_months: number
  auto_renewal: boolean
  start_date: string
  end_date: string
  equipment_list: EquipmentItem[]
  payment_method: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  signed_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  created_at: string
  updated_at: string
}

export interface EquipmentItem {
  name: string
  quantity: number
}

export interface Payment {
  id: string
  org_id: string
  contract_id: string
  contact_id: string
  amount: number
  status: PaymentStatus
  type: PaymentType
  stripe_payment_id: string | null
  failure_reason: string | null
  paid_at: string
  created_at: string
}

export type ContractStatus = 'active' | 'pending' | 'expired' | 'cancelled' | 'past_due'
export type PaymentStatus = 'succeeded' | 'failed' | 'refunded' | 'pending'
export type PaymentType = 'equipment' | 'monitoring' | 'refund'

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  active: 'Active',
  pending: 'Pending',
  expired: 'Expired',
  cancelled: 'Cancelled',
  past_due: 'Past Due',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  succeeded: 'Succeeded',
  failed: 'Failed',
  refunded: 'Refunded',
  pending: 'Pending',
}
