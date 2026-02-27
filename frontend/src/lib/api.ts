import axios from 'axios'
import type { PaginatedResponse } from '@/types/api'
import type { Contact, Activity } from '@/types/contact'
import type { Deal, DealDetail, Pipeline, PipelineDetail, PipelineStage } from '@/types/pipeline'
import type { Task } from '@/types/task'
import type { Quote } from '@/types/quote'
import type { Contract, Payment, Subscription } from '@/types/contract'
import type { Invoice } from '@/types/invoice'

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1'

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
  created_at: string
  updated_at: string
}

export const organizationApi = {
  get: () =>
    api.get<Organization>('/organization').then((r) => r.data),

  update: (data: Partial<Organization>) =>
    api.put<Organization>('/organization', data).then((r) => r.data),
}

export default api
