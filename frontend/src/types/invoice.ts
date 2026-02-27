export interface Invoice {
  id: string
  org_id: string
  contract_id: string
  contact_id: string
  invoice_number: string
  type: InvoiceType
  status: InvoiceStatus
  line_items: InvoiceLine[]
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  due_date: string
  sent_at: string | null
  paid_at: string | null
  voided_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceLine {
  description: string
  quantity: number
  unit_price: number
  total: number
}

export type InvoiceType = 'one_time' | 'recurring'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  one_time: 'One-Time',
  recurring: 'Recurring',
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
}

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-info/10 text-info',
  paid: 'bg-success/10 text-success',
  overdue: 'bg-danger/10 text-danger',
  cancelled: 'bg-muted text-muted-foreground',
}
