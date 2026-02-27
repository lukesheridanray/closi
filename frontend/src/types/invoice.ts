export interface Invoice {
  id: string
  organization_id: string
  contact_id: string
  contract_id: string | null
  subscription_id: string | null
  invoice_number: string
  status: InvoiceStatus
  invoice_date: string
  due_date: string
  subtotal: number
  tax_amount: number
  total: number
  amount_paid: number
  amount_due: number
  currency: string
  memo: string | null
  line_items: InvoiceLine[] | null
  pdf_url: string | null
  sent_at: string | null
  paid_at: string | null
  voided_at: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceLine {
  description: string
  quantity: number
  unit_price: number
  amount: number
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'past_due' | 'void'

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  past_due: 'Past Due',
  void: 'Void',
}

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-info/10 text-info',
  paid: 'bg-success/10 text-success',
  past_due: 'bg-danger/10 text-danger',
  void: 'bg-muted text-muted-foreground',
}
