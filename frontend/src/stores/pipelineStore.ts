import { create } from 'zustand'
import type { Pipeline, PipelineStage, Deal, Contact, StageHistory } from '@/types/pipeline'

interface PipelineState {
  pipelines: Pipeline[]
  stages: PipelineStage[]
  deals: Deal[]
  contacts: Contact[]
  stageHistory: StageHistory[]
  activePipelineId: string
  selectedDealId: string | null

  selectDeal: (dealId: string | null) => void
  moveDeal: (dealId: string, toStageId: string) => void
}

// --- Mock Data ---

const ORG_ID = 'org_01'
const PIPELINE_ID = 'pipeline_01'

const mockPipelines: Pipeline[] = [
  {
    id: PIPELINE_ID,
    org_id: ORG_ID,
    name: 'Sales Pipeline',
    is_default: true,
    created_at: '2025-01-15T08:00:00Z',
    updated_at: '2025-01-15T08:00:00Z',
  },
]

const mockStages: PipelineStage[] = [
  { id: 'stage_01', pipeline_id: PIPELINE_ID, name: 'New Lead', color: '#6C63FF', position: 0, is_won: false, is_lost: false, stale_days: 3, created_at: '2025-01-15T08:00:00Z' },
  { id: 'stage_02', pipeline_id: PIPELINE_ID, name: 'Contacted', color: '#3B82F6', position: 1, is_won: false, is_lost: false, stale_days: 5, created_at: '2025-01-15T08:00:00Z' },
  { id: 'stage_03', pipeline_id: PIPELINE_ID, name: 'Consultation Scheduled', color: '#8B5CF6', position: 2, is_won: false, is_lost: false, stale_days: 7, created_at: '2025-01-15T08:00:00Z' },
  { id: 'stage_04', pipeline_id: PIPELINE_ID, name: 'Quote Sent', color: '#F59E0B', position: 3, is_won: false, is_lost: false, stale_days: 7, created_at: '2025-01-15T08:00:00Z' },
  { id: 'stage_05', pipeline_id: PIPELINE_ID, name: 'Negotiation', color: '#F97316', position: 4, is_won: false, is_lost: false, stale_days: 10, created_at: '2025-01-15T08:00:00Z' },
  { id: 'stage_06', pipeline_id: PIPELINE_ID, name: 'Install Scheduled', color: '#22C55E', position: 5, is_won: false, is_lost: false, stale_days: 14, created_at: '2025-01-15T08:00:00Z' },
  { id: 'stage_07', pipeline_id: PIPELINE_ID, name: 'Installed', color: '#14B8A6', position: 6, is_won: false, is_lost: false, stale_days: 7, created_at: '2025-01-15T08:00:00Z' },
  { id: 'stage_08', pipeline_id: PIPELINE_ID, name: 'Contract Signed', color: '#10B981', position: 7, is_won: true, is_lost: false, stale_days: 30, created_at: '2025-01-15T08:00:00Z' },
  { id: 'stage_09', pipeline_id: PIPELINE_ID, name: 'Lost', color: '#EF4444', position: 8, is_won: false, is_lost: true, stale_days: 30, created_at: '2025-01-15T08:00:00Z' },
]

const mockContacts: Contact[] = [
  { id: 'contact_01', org_id: ORG_ID, first_name: 'James', last_name: 'Wilson', email: 'james.wilson@email.com', phone: '(555) 234-5678', company: 'Wilson Residence', address: '742 Evergreen Terrace', city: 'Springfield', state: 'IL', zip: '62704', created_at: '2025-02-01T10:00:00Z' },
  { id: 'contact_02', org_id: ORG_ID, first_name: 'Maria', last_name: 'Garcia', email: 'maria.garcia@email.com', phone: '(555) 345-6789', company: null, address: '1234 Oak Street', city: 'Austin', state: 'TX', zip: '73301', created_at: '2025-02-03T09:30:00Z' },
  { id: 'contact_03', org_id: ORG_ID, first_name: 'Robert', last_name: 'Chen', email: 'robert.chen@techcorp.com', phone: '(555) 456-7890', company: 'TechCorp Office', address: '500 Innovation Drive', city: 'San Jose', state: 'CA', zip: '95110', created_at: '2025-02-05T14:00:00Z' },
  { id: 'contact_04', org_id: ORG_ID, first_name: 'Sarah', last_name: 'Thompson', email: 'sarah.t@email.com', phone: '(555) 567-8901', company: null, address: '88 Maple Avenue', city: 'Denver', state: 'CO', zip: '80201', created_at: '2025-02-07T11:00:00Z' },
  { id: 'contact_05', org_id: ORG_ID, first_name: 'Michael', last_name: 'Johnson', email: 'mjohnson@email.com', phone: '(555) 678-9012', company: 'Johnson & Sons', address: '312 Pine Road', city: 'Phoenix', state: 'AZ', zip: '85001', created_at: '2025-02-10T08:00:00Z' },
  { id: 'contact_06', org_id: ORG_ID, first_name: 'Emily', last_name: 'Davis', email: 'emily.d@email.com', phone: '(555) 789-0123', company: null, address: '1567 Cedar Lane', city: 'Portland', state: 'OR', zip: '97201', created_at: '2025-02-12T10:30:00Z' },
  { id: 'contact_07', org_id: ORG_ID, first_name: 'David', last_name: 'Martinez', email: 'david.m@email.com', phone: '(555) 890-1234', company: 'Martinez Properties', address: '445 Birch Street', city: 'Miami', state: 'FL', zip: '33101', created_at: '2025-02-14T09:00:00Z' },
  { id: 'contact_08', org_id: ORG_ID, first_name: 'Jennifer', last_name: 'Lee', email: 'jlee@email.com', phone: '(555) 901-2345', company: null, address: '789 Willow Way', city: 'Seattle', state: 'WA', zip: '98101', created_at: '2025-02-16T13:00:00Z' },
  { id: 'contact_09', org_id: ORG_ID, first_name: 'Andrew', last_name: 'Brown', email: 'andrew.b@email.com', phone: '(555) 012-3456', company: 'Brown Construction', address: '2100 Elm Boulevard', city: 'Nashville', state: 'TN', zip: '37201', created_at: '2025-02-18T07:30:00Z' },
  { id: 'contact_10', org_id: ORG_ID, first_name: 'Lisa', last_name: 'Anderson', email: 'lisa.a@email.com', phone: '(555) 123-4567', company: null, address: '33 Spruce Court', city: 'Charlotte', state: 'NC', zip: '28201', created_at: '2025-02-20T15:00:00Z' },
]

const now = new Date().toISOString()

// Helper: date N days ago
function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

const mockDeals: Deal[] = [
  // New Lead (stage_01) - 2 deals
  { id: 'deal_01', org_id: ORG_ID, pipeline_id: PIPELINE_ID, stage_id: 'stage_01', contact_id: 'contact_01', title: 'Wilson Home Security System', value: 3200, probability: 10, expected_close_date: '2025-04-15', source: 'Website', assigned_to: 'Rep A', notes: 'Interested in full home security package with cameras.', created_at: daysAgo(2), updated_at: daysAgo(2) },
  { id: 'deal_02', org_id: ORG_ID, pipeline_id: PIPELINE_ID, stage_id: 'stage_01', contact_id: 'contact_02', title: 'Garcia Alarm Upgrade', value: 1800, probability: 10, expected_close_date: '2025-04-20', source: 'Referral', assigned_to: 'Rep B', notes: 'Wants to upgrade existing alarm system.', created_at: daysAgo(5), updated_at: daysAgo(5) },

  // Contacted (stage_02) - 2 deals
  { id: 'deal_03', org_id: ORG_ID, pipeline_id: PIPELINE_ID, stage_id: 'stage_02', contact_id: 'contact_03', title: 'TechCorp Office Security', value: 5400, probability: 25, expected_close_date: '2025-05-01', source: 'Cold Call', assigned_to: 'Rep A', notes: 'Commercial office, needs access control + cameras.', created_at: daysAgo(8), updated_at: daysAgo(6) },
  { id: 'deal_04', org_id: ORG_ID, pipeline_id: PIPELINE_ID, stage_id: 'stage_02', contact_id: 'contact_04', title: 'Thompson Smart Home Package', value: 2800, probability: 20, expected_close_date: '2025-04-25', source: 'Website', assigned_to: 'Rep C', notes: 'Interested in smart locks, doorbell cam, and sensors.', created_at: daysAgo(12), updated_at: daysAgo(10) },

  // Consultation Scheduled (stage_03) - 2 deals
  { id: 'deal_05', org_id: ORG_ID, pipeline_id: PIPELINE_ID, stage_id: 'stage_03', contact_id: 'contact_05', title: 'Johnson Business Alarm', value: 4100, probability: 40, expected_close_date: '2025-04-10', source: 'Referral', assigned_to: 'Rep A', notes: 'Multi-location business alarm system.', created_at: daysAgo(14), updated_at: daysAgo(3) },
  { id: 'deal_06', org_id: ORG_ID, pipeline_id: PIPELINE_ID, stage_id: 'stage_03', contact_id: 'contact_06', title: 'Davis Home Cameras', value: 1600, probability: 35, expected_close_date: '2025-05-05', source: 'Website', assigned_to: 'Rep B', notes: 'Outdoor camera system with night vision.', created_at: daysAgo(10), updated_at: daysAgo(2) },

  // Quote Sent (stage_04) - 2 deals
  { id: 'deal_07', org_id: ORG_ID, pipeline_id: PIPELINE_ID, stage_id: 'stage_04', contact_id: 'contact_07', title: 'Martinez Property Monitoring', value: 3800, probability: 55, expected_close_date: '2025-03-30', source: 'Partner', assigned_to: 'Rep C', notes: '24/7 monitoring for rental properties.', created_at: daysAgo(18), updated_at: daysAgo(9) },
  { id: 'deal_08', org_id: ORG_ID, pipeline_id: PIPELINE_ID, stage_id: 'stage_04', contact_id: 'contact_08', title: 'Lee Condo Security', value: 1200, probability: 50, expected_close_date: '2025-04-05', source: 'Website', assigned_to: 'Rep A', notes: 'Basic alarm + doorbell camera for condo.', created_at: daysAgo(15), updated_at: daysAgo(1) },

  // Negotiation (stage_05) - 1 deal
  { id: 'deal_09', org_id: ORG_ID, pipeline_id: PIPELINE_ID, stage_id: 'stage_05', contact_id: 'contact_09', title: 'Brown Construction Site Security', value: 4800, probability: 70, expected_close_date: '2025-03-25', source: 'Cold Call', assigned_to: 'Rep B', notes: 'Temporary security for active construction site.', created_at: daysAgo(22), updated_at: daysAgo(4) },

  // Install Scheduled (stage_06) - 1 deal
  { id: 'deal_10', org_id: ORG_ID, pipeline_id: PIPELINE_ID, stage_id: 'stage_06', contact_id: 'contact_10', title: 'Anderson Full Home Package', value: 3500, probability: 85, expected_close_date: '2025-03-20', source: 'Referral', assigned_to: 'Rep A', notes: 'Full security package: alarm, cameras, smart locks.', created_at: daysAgo(28), updated_at: daysAgo(2) },

  // Contract Signed / Won (stage_08) - 1 deal
  { id: 'deal_11', org_id: ORG_ID, pipeline_id: PIPELINE_ID, stage_id: 'stage_08', contact_id: 'contact_01', title: 'Wilson Monitoring Contract', value: 2400, probability: 100, expected_close_date: '2025-03-10', source: 'Upsell', assigned_to: 'Rep A', notes: '36-month monitoring agreement signed.', created_at: daysAgo(35), updated_at: daysAgo(5) },

  // Lost (stage_09) - 1 deal
  { id: 'deal_12', org_id: ORG_ID, pipeline_id: PIPELINE_ID, stage_id: 'stage_09', contact_id: 'contact_04', title: 'Thompson Basic Package', value: 1400, probability: 0, expected_close_date: null, source: 'Website', assigned_to: 'Rep C', notes: 'Customer went with a competitor on price.', created_at: daysAgo(30), updated_at: daysAgo(8) },
]

const mockStageHistory: StageHistory[] = mockDeals.map((deal) => ({
  id: `sh_${deal.id}`,
  deal_id: deal.id,
  from_stage_id: null,
  to_stage_id: deal.stage_id,
  moved_at: deal.created_at,
  moved_by: deal.assigned_to,
}))

// --- Store ---

const usePipelineStore = create<PipelineState>((set) => ({
  pipelines: mockPipelines,
  stages: mockStages,
  deals: mockDeals,
  contacts: mockContacts,
  stageHistory: mockStageHistory,
  activePipelineId: PIPELINE_ID,
  selectedDealId: null,

  selectDeal: (dealId) => set({ selectedDealId: dealId }),

  moveDeal: (dealId, toStageId) =>
    set((state) => {
      const deal = state.deals.find((d) => d.id === dealId)
      if (!deal || deal.stage_id === toStageId) return state

      const updatedDeals = state.deals.map((d) =>
        d.id === dealId
          ? { ...d, stage_id: toStageId, updated_at: now }
          : d,
      )

      const newHistoryEntry: StageHistory = {
        id: `sh_${dealId}_${Date.now()}`,
        deal_id: dealId,
        from_stage_id: deal.stage_id,
        to_stage_id: toStageId,
        moved_at: new Date().toISOString(),
        moved_by: deal.assigned_to,
      }

      return {
        deals: updatedDeals,
        stageHistory: [...state.stageHistory, newHistoryEntry],
      }
    }),
}))

export default usePipelineStore
