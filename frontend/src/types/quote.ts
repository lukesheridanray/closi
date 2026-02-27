export interface QuoteLine {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  total: number
}

export interface Quote {
  id: string
  organization_id: string
  deal_id: string
  contact_id: string
  created_by: string | null
  title: string
  status: QuoteStatus
  equipment_lines: QuoteLine[]
  equipment_total: number
  monthly_monitoring_amount: number
  contract_term_months: number
  auto_renewal: boolean
  total_contract_value: number
  notes: string | null
  valid_until: string | null
  sent_at: string | null
  accepted_at: string | null
  pdf_url: string | null
  created_at: string
  updated_at: string
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
}
