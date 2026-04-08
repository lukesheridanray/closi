import axios from 'axios'
import type { PaginatedResponse } from '@/types/api'
import type { Contact, Activity } from '@/types/contact'
import type { Deal, DealDetail, PipelineDetail, PipelineStage } from '@/types/pipeline'
import type { Task } from '@/types/task'
import type { Quote } from '@/types/quote'
import type { Contract, Payment, Subscription } from '@/types/contract'
import type { Invoice } from '@/types/invoice'

const rawApiBase = import.meta.env.VITE_API_URL?.replace(/\/$/, '')
const API_BASE = rawApiBase
  ? (rawApiBase.endsWith('/api/v1') ? rawApiBase : `${rawApiBase}/api/v1`)
  : '/api/v1'

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: attach JWT access token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: handle 401 with token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = localStorage.getItem('refresh_token')
        if (!refreshToken) {
          throw new Error('No refresh token')
        }

        const { data } = await axios.post(`${API_BASE}/auth/refresh`, {
          refresh_token: refreshToken,
        })

        localStorage.setItem('access_token', data.access_token)
        localStorage.setItem('refresh_token', data.refresh_token)

        originalRequest.headers.Authorization = `Bearer ${data.access_token}`
        return api(originalRequest)
      } catch {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/signin'
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)

// ── Contacts ─────────────────────────────────────────

export const contactsApi = {
  list: (params?: {
    page?: number
    page_size?: number
    search?: string
    lead_source?: string
    status?: string
    sort_by?: string
    sort_dir?: string
  }) =>
    api.get<PaginatedResponse<Contact>>('/contacts', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<Contact>(`/contacts/${id}`).then((r) => r.data),

  create: (data: Partial<Contact>) =>
    api.post<Contact>('/contacts', data).then((r) => r.data),

  update: (id: string, data: Partial<Contact>) =>
    api.put<Contact>(`/contacts/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/contacts/${id}`).then((r) => r.data),

  import: (data: { rows: Record<string, string>[]; mappings: Record<string, string>; duplicate_action?: string }) =>
    api.post<{ imported: number; updated: number; skipped: number; failed: number; failed_rows: Record<string, string>[] }>(
      '/contacts/import', data
    ).then((r) => r.data),
}

// ── Deals ────────────────────────────────────────────

export const dealsApi = {
  list: (params?: {
    page?: number
    page_size?: number
    pipeline_id?: string
    stage_id?: string
    assigned_to?: string
    search?: string
    sort_by?: string
    sort_dir?: string
  }) =>
    api.get<PaginatedResponse<Deal>>('/deals', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<DealDetail>(`/deals/${id}`).then((r) => r.data),

  create: (data: Partial<Deal>) =>
    api.post<Deal>('/deals', data).then((r) => r.data),

  update: (id: string, data: Partial<Deal>) =>
    api.put<Deal>(`/deals/${id}`, data).then((r) => r.data),

  moveStage: (id: string, stageId: string) =>
    api.patch<Deal>(`/deals/${id}/stage`, { stage_id: stageId }).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/deals/${id}`).then((r) => r.data),

  import: (data: {
    rows: Array<{
      first_name?: string
      last_name?: string
      email?: string
      phone?: string
      company?: string
      address?: string
      city?: string
      state?: string
      zip?: string
      lead_source?: string
      title: string
      estimated_value?: number
      notes?: string
      expected_close_date?: string
    }>
    pipeline_id: string
    stage_id: string
    assigned_to_override?: string | null
    lead_source_override?: string | null
    duplicate_action?: string
  }) =>
    api.post<{
      imported: number
      skipped: number
      failed: number
      contacts_created: number
      contacts_matched: number
      failed_rows: Array<{ row: number; reason: string }>
    }>('/deals/import', data).then((r) => r.data),
}

// ── Pipelines ────────────────────────────────────────

export const pipelinesApi = {
  list: () =>
    api.get<PipelineDetail[]>('/pipelines').then((r) => r.data),

  getStages: (pipelineId: string) =>
    api.get<PipelineStage[]>(`/pipelines/${pipelineId}/stages`).then((r) => r.data),

  createStage: (pipelineId: string, data: Partial<PipelineStage>) =>
    api.post<PipelineStage>(`/pipelines/${pipelineId}/stages`, data).then((r) => r.data),

  updateStage: (pipelineId: string, stageId: string, data: Partial<PipelineStage>) =>
    api.put<PipelineStage>(`/pipelines/${pipelineId}/stages/${stageId}`, data).then((r) => r.data),

  deleteStage: (pipelineId: string, stageId: string) =>
    api.delete(`/pipelines/${pipelineId}/stages/${stageId}`).then((r) => r.data),

  reorderStages: (pipelineId: string, stageIds: string[]) =>
    api.put(`/pipelines/${pipelineId}/stages/reorder`, { stage_ids: stageIds }).then((r) => r.data),
}

// ── Tasks ────────────────────────────────────────────

export const tasksApi = {
  list: (params?: {
    page?: number
    page_size?: number
    status?: string
    priority?: string
    type?: string
    assigned_to?: string
    contact_id?: string
    deal_id?: string
    due_date_from?: string
    due_date_to?: string
    search?: string
    sort_by?: string
    sort_dir?: string
  }) =>
    api.get<PaginatedResponse<Task>>('/tasks', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<Task>(`/tasks/${id}`).then((r) => r.data),

  create: (data: Partial<Task>) =>
    api.post<Task>('/tasks', data).then((r) => r.data),

  update: (id: string, data: Partial<Task>) =>
    api.put<Task>(`/tasks/${id}`, data).then((r) => r.data),

  complete: (id: string) =>
    api.patch<Task>(`/tasks/${id}/complete`).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/tasks/${id}`).then((r) => r.data),
}

// ── Quotes ───────────────────────────────────────────

export const quotesApi = {
  list: (params?: {
    page?: number
    page_size?: number
    status?: string
    search?: string
    sort_by?: string
    sort_dir?: string
  }) =>
    api.get<PaginatedResponse<Quote>>('/quotes', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<Quote>(`/quotes/${id}`).then((r) => r.data),

  create: (data: Partial<Quote>) =>
    api.post<Quote>('/quotes', data).then((r) => r.data),

  update: (id: string, data: Partial<Quote>) =>
    api.put<Quote>(`/quotes/${id}`, data).then((r) => r.data),

  accept: (id: string) =>
    api.post<Quote>(`/quotes/${id}/accept`).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/quotes/${id}`).then((r) => r.data),

  send: (id: string) =>
    api.post<Quote>(`/quotes/${id}/send`).then((r) => r.data),

  getPdf: (id: string) =>
    api.get(`/quotes/${id}/pdf`, { responseType: 'blob' }).then((r) => r.data),
}

// ── Contracts ────────────────────────────────────────

export const contractsApi = {
  list: (params?: {
    page?: number
    page_size?: number
    status?: string
    search?: string
  }) =>
    api.get<PaginatedResponse<Contract>>('/contracts', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<Contract>(`/contracts/${id}`).then((r) => r.data),

  create: (data: Partial<Contract>) =>
    api.post<Contract>('/contracts', data).then((r) => r.data),

  update: (id: string, data: Partial<Contract>) =>
    api.put<Contract>(`/contracts/${id}`, data).then((r) => r.data),
}

// ── Invoices ─────────────────────────────────────────

export const invoicesApi = {
  list: (params?: {
    page?: number
    page_size?: number
    status?: string
    search?: string
    sort_by?: string
    sort_dir?: string
  }) =>
    api.get<PaginatedResponse<Invoice>>('/invoices', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<Invoice>(`/invoices/${id}`).then((r) => r.data),

  create: (data: Partial<Invoice>) =>
    api.post<Invoice>('/invoices', data).then((r) => r.data),

  update: (id: string, data: Partial<Invoice>) =>
    api.put<Invoice>(`/invoices/${id}`, data).then((r) => r.data),

  send: (id: string) =>
    api.post<Invoice>(`/invoices/${id}/send`).then((r) => r.data),

  markPaid: (id: string) =>
    api.patch<Invoice>(`/invoices/${id}/mark-paid`).then((r) => r.data),

  void: (id: string) =>
    api.patch<Invoice>(`/invoices/${id}/void`).then((r) => r.data),

  getPdf: (id: string) =>
    api.get(`/invoices/${id}/pdf`, { responseType: 'blob' }).then((r) => r.data),
}

// ── Payments ─────────────────────────────────────────

export const paymentsApi = {
  list: (params?: {
    page?: number
    page_size?: number
    contact_id?: string
    contract_id?: string
  }) =>
    api.get<PaginatedResponse<Payment>>('/payments', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<Payment>(`/payments/${id}`).then((r) => r.data),
}

// ── Subscriptions ───────────────────────────────

export const subscriptionsApi = {
  list: (params?: {
    page?: number
    page_size?: number
    contact_id?: string
    status_filter?: string
  }) =>
    api.get<PaginatedResponse<Subscription>>('/subscriptions', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<Subscription>(`/subscriptions/${id}`).then((r) => r.data),
}

// ── Activities ───────────────────────────────────────

export const activitiesApi = {
  list: (params?: {
    page?: number
    page_size?: number
    contact_id?: string
    deal_id?: string
    type?: string
  }) =>
    api.get<PaginatedResponse<Activity>>('/activities', { params }).then((r) => r.data),

  create: (data: Partial<Activity>) =>
    api.post<Activity>('/activities', data).then((r) => r.data),
}

// ── Analytics ────────────────────────────────────────

export interface DashboardKPI {
  label: string
  value: number | string
  change_pct: number | null
  trend: 'up' | 'down' | 'flat' | null
}

export interface PipelineStageSummary {
  stage_id: string
  stage_name: string
  color: string
  deal_count: number
  total_value: number
}

export interface RepLeaderboardEntry {
  user_id: string
  name: string
  deals_closed: number
  revenue: number
  activities: number
}

export interface DashboardResponse {
  kpis: DashboardKPI[]
  pipeline_by_stage: PipelineStageSummary[]
  rep_leaderboard: RepLeaderboardEntry[]
}

export interface RecurringRevenueResponse {
  current_mrr: number
  mrr_trend: { month: string; mrr: number; new_mrr: number; churned_mrr: number }[]
  active_subscriptions: number
  churn_rate: number
  avg_revenue_per_account: number
}

export interface PipelineSummaryResponse {
  stages: PipelineStageSummary[]
  total_pipeline_value: number
  total_deals: number
}

export const analyticsApi = {
  getDashboard: () =>
    api.get<DashboardResponse>('/analytics/dashboard').then((r) => r.data),

  getRepDashboard: () =>
    api.get<{ kpis: DashboardKPI[]; my_pipeline: PipelineStageSummary[] }>('/analytics/rep-dashboard').then((r) => r.data),

  getRecurringRevenue: () =>
    api.get<RecurringRevenueResponse>('/analytics/recurring-revenue').then((r) => r.data),

  getPipelineSummary: () =>
    api.get<PipelineSummaryResponse>('/analytics/pipeline-summary').then((r) => r.data),
}

// ── Users ────────────────────────────────────────────

export interface User {
  id: string
  organization_id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  role: string
  avatar_url: string | null
  is_active: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export const usersApi = {
  list: () =>
    api.get<{ items: User[] }>('/users').then((r) => r.data),

  invite: (data: { email: string; first_name: string; last_name: string; role: string }) =>
    api.post<User>('/users/invite', data).then((r) => r.data),

  update: (id: string, data: Partial<User>) =>
    api.put<User>(`/users/${id}`, data).then((r) => r.data),
}

// ── Organization ─────────────────────────────────────

export interface Organization {
  id: string
  name: string
  slug: string
  email: string
  phone: string | null
  address_line1: string | null
  city: string | null
  state: string | null
  zip: string | null
  timezone: string
  currency: string
  plan: string
  settings: Record<string, unknown> | null
  is_active: boolean
  stripe_account_id: string | null
  stripe_connected: boolean
  stripe_onboarding_complete: boolean
  created_at: string
  updated_at: string
}

export const organizationApi = {
  get: () =>
    api.get<Organization>('/organization').then((r) => r.data),

  update: (data: Partial<Organization>) =>
    api.put<Organization>('/organization', data).then((r) => r.data),
}

// ── Stripe Integration ──────────────────────────────

export interface StripeStatus {
  connected: boolean
  account_id: string | null
  onboarding_complete: boolean
  charges_enabled: boolean
  business_name: string | null
  environment: string | null
  error: string | null
}

export interface SetupIntentData {
  client_secret: string
  setup_intent_id: string
  customer_id: string
  stripe_account_id: string
}

export interface PaymentProfile {
  id: string
  contact_id: string
  external_customer_id: string | null
  external_payment_id: string | null
  payment_method_type: string | null
  payment_method_last4: string | null
  payment_method_brand: string | null
  payment_method_exp_month: number | null
  payment_method_exp_year: number | null
  is_default: boolean
  status: string
}

export interface WebhookLog {
  id: string
  external_event_id: string | null
  event_type: string
  processing_status: string
  error_message: string | null
  received_at: string
  processed_at: string | null
}

export const stripeApi = {
  getConfig: () =>
    api.get<{ publishable_key: string }>('/integrations/stripe/config').then((r) => r.data),

  getStatus: () =>
    api.get<StripeStatus>('/integrations/stripe/status').then((r) => r.data),

  connect: () =>
    api.get<{ url: string }>('/integrations/stripe/connect').then((r) => r.data),

  callback: () =>
    api.get('/integrations/stripe/callback').then((r) => r.data),

  disconnect: () =>
    api.delete('/integrations/stripe/disconnect').then((r) => r.data),

  getDashboardLink: () =>
    api.get<{ url: string }>('/integrations/stripe/dashboard-link').then((r) => r.data),

  createSetupIntent: (contactId: string) =>
    api.post<SetupIntentData>('/integrations/stripe/setup-intent', { contact_id: contactId }).then((r) => r.data),

  attachPaymentMethod: (contactId: string, paymentMethodId: string) =>
    api.post<PaymentProfile>('/integrations/stripe/attach-payment-method', {
      contact_id: contactId,
      payment_method_id: paymentMethodId,
    }).then((r) => r.data),

  createSubscription: (contractId: string) =>
    api.post<{ id: string; status: string; amount: number }>('/integrations/stripe/create-subscription', {
      contract_id: contractId,
    }).then((r) => r.data),

  chargeEquipment: (contractId: string) =>
    api.post<{ payment_id: string; amount: number; status: string }>('/integrations/stripe/charge-equipment', {
      contract_id: contractId,
    }).then((r) => r.data),

  getWebhookLogs: () =>
    api.get<WebhookLog[]>('/integrations/stripe/webhook-logs').then((r) => r.data),
}

// ── Authorize.net Integration ───────────────────────

export interface AuthnetStatus {
  connected: boolean
  provider_type: string
  display_name: string | null
  environment: string | null
  auto_invoice: boolean | null
  retry_failed_days: number | null
  retry_max_attempts: number | null
}

export interface HostedProfilePageSession {
  token: string
  url: string
  customer_profile_id: string
  environment: string
}

export interface BillingAccountRow {
  contact_id: string
  customer_name: string
  company: string | null
  email: string | null
  phone: string | null
  lead_source: string
  contact_status: string
  contract_id: string | null
  contract_title: string | null
  contract_status: string | null
  has_billing_profile: boolean
  has_card_on_file: boolean
  payment_method_type: string | null
  payment_method_last4: string | null
  payment_method_brand: string | null
  monthly_amount: number | null
  subscription_status: string | null
  next_billing_date: string | null
  last_payment_date: string | null
  last_payment_amount: number | null
  last_payment_status: string | null
  failed_payment_count: number
  billing_flag: string
  outstanding_balance: number
  lifetime_revenue: number
  updated_at: string
}

export interface BillingAccountListResponse {
  items: BillingAccountRow[]
  meta: PaginatedResponse<unknown>['meta']
  total_mrr: number
  past_due_count: number
  missing_card_count: number
}

export const billingApi = {
  listAccounts: (params?: {
    page?: number
    page_size?: number
    search?: string
    billing_flag?: string
  }) =>
    api.get<BillingAccountListResponse>('/billing/accounts', { params }).then((r) => r.data),
}

export const authnetApi = {
  getStatus: () =>
    api.get<AuthnetStatus>('/integrations/authnet/status').then((r) => r.data),

  connect: (data: {
    api_login_id: string
    transaction_key: string
    signature_key?: string
    environment?: string
  }) =>
    api.post<{ connected: boolean; environment: string }>('/integrations/authnet/connect', data).then((r) => r.data),

  disconnect: () =>
    api.delete('/integrations/authnet/disconnect').then((r) => r.data),

  getCustomerProfile: (contactId: string) =>
    api.get<PaymentProfile>(`/integrations/authnet/customer-profile/${contactId}`).then((r) => r.data),

  syncCustomerProfile: (contactId: string) =>
    api.post<PaymentProfile>(`/integrations/authnet/customer-profile/${contactId}/sync`).then((r) => r.data),

  createCustomer: (contactId: string) =>
    api.post<PaymentProfile>('/integrations/authnet/create-customer', { contact_id: contactId }).then((r) => r.data),

  createHostedProfilePage: (data: { contact_id: string; action?: string; return_url?: string }) =>
    api.post<HostedProfilePageSession>('/integrations/authnet/hosted-profile-page', data).then((r) => r.data),

  addPaymentProfile: (contactId: string, card: { card_number: string; expiration_date: string; card_code: string }) =>
    api.post<PaymentProfile>('/integrations/authnet/add-payment-profile', {
      contact_id: contactId,
      ...card,
    }).then((r) => r.data),

  addBankAccount: (contactId: string, bank: { routing_number: string; account_number: string; name_on_account: string; account_type?: string; echeck_type?: string }) =>
    api.post<PaymentProfile>('/integrations/authnet/add-bank-account', {
      contact_id: contactId,
      ...bank,
    }).then((r) => r.data),

  charge: (data: { contact_id: string; amount: number; description?: string; contract_id?: string }) =>
    api.post<{ payment_id: string; amount: number; status: string; failure_code?: string | null; failure_message?: string | null }>('/integrations/authnet/charge', data).then((r) => r.data),

  createSubscription: (contractId: string) =>
    api.post<{ id: string; status: string; amount: number }>('/integrations/authnet/create-subscription', {
      contract_id: contractId,
    }).then((r) => r.data),

  cancelSubscription: (subscriptionId: string, reason?: string) =>
    api.post<{ status: string; cancelled_at: string }>('/integrations/authnet/cancel-subscription', {
      subscription_id: subscriptionId,
      reason: reason || 'Cancelled by user',
    }).then((r) => r.data),

  getSubscriptionStatus: (subscriptionId: string) =>
    api.get<{ status: string; arb_status?: string; synced: boolean }>(`/integrations/authnet/subscription-status/${subscriptionId}`).then((r) => r.data),

  getWebhookLogs: () =>
    api.get<WebhookLog[]>('/integrations/authnet/webhook-logs').then((r) => r.data),

  reconcile: (dateFrom?: string, dateTo?: string) =>
    api.post<{
      date_from: string
      date_to: string
      total_gateway_transactions: number
      total_local_payments: number
      matched: number
      mismatches: Array<{ trans_id: string; amount: number; local_status: string; gateway_status: string; corrected_to: string }>
      missing_local: Array<{ trans_id: string; amount: number; gateway_status: string }>
      missing_gateway: Array<{ trans_id: string; amount: number; local_status: string; contact_id: string }>
      corrections_applied: number
      reconciled_at: string
    }>('/integrations/authnet/reconcile', {
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }).then((r) => r.data),
}

// ── Products ────────────────────────────────────────

export interface Product {
  id: string
  organization_id: string
  name: string
  sku: string | null
  category: string
  description: string | null
  unit_cost: number
  retail_price: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export const productsApi = {
  list: (params?: { search?: string; category?: string; is_active?: boolean }) =>
    api.get<PaginatedResponse<Product>>('/products', { params: { page_size: 100, ...params } }).then((r) => r.data),

  get: (id: string) =>
    api.get<Product>(`/products/${id}`).then((r) => r.data),

  create: (data: Partial<Product>) =>
    api.post<Product>('/products', data).then((r) => r.data),

  update: (id: string, data: Partial<Product>) =>
    api.put<Product>(`/products/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/products/${id}`).then((r) => r.data),

  seed: () =>
    api.post('/products/seed').then((r) => r.data),
}

export default api
