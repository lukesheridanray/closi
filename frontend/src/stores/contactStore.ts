import { create } from 'zustand'
import type {
  Contact,
  Activity,
  LeadSource,
  ContactStatus,
  ActivityType,
} from '@/types/contact'

// --- Types ---

export type SortField = 'name' | 'email' | 'source' | 'status' | 'created_at'
export type SortDir = 'asc' | 'desc'

interface ContactState {
  contacts: Contact[]
  activities: Activity[]
  selectedContactId: string | null
  search: string
  sourceFilter: LeadSource | 'all'
  statusFilter: ContactStatus | 'all'
  sortField: SortField
  sortDir: SortDir
  page: number
  pageSize: number

  // Actions
  selectContact: (id: string | null) => void
  setSearch: (q: string) => void
  setSourceFilter: (source: LeadSource | 'all') => void
  setStatusFilter: (status: ContactStatus | 'all') => void
  setSort: (field: SortField) => void
  setPage: (page: number) => void
  addActivity: (activity: Omit<Activity, 'id' | 'org_id' | 'created_at'>) => void
  addContacts: (contacts: Omit<Contact, 'id' | 'org_id' | 'created_at' | 'updated_at'>[]) => void
  updateContact: (id: string, updates: Partial<Contact>) => void
}

// --- Helpers ---

const ORG_ID = 'org_01'

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

// --- Mock Contacts (15) ---

const mockContacts: Contact[] = [
  { id: 'contact_01', org_id: ORG_ID, first_name: 'James', last_name: 'Wilson', email: 'james.wilson@email.com', phone: '(555) 234-5678', company: 'Wilson Residence', address: '742 Evergreen Terrace', city: 'Springfield', state: 'IL', zip: '62704', lead_source: 'website', status: 'customer', property_type: 'single_family', assigned_to: 'Rep A', tags: ['vip', 'monitoring'], notes: 'Long-term customer, very responsive.', created_at: daysAgo(90), updated_at: daysAgo(5) },
  { id: 'contact_02', org_id: ORG_ID, first_name: 'Maria', last_name: 'Garcia', email: 'maria.garcia@email.com', phone: '(555) 345-6789', company: null, address: '1234 Oak Street', city: 'Austin', state: 'TX', zip: '73301', lead_source: 'referral', status: 'active', property_type: 'townhouse', assigned_to: 'Rep B', tags: ['upgrade'], notes: 'Referred by James Wilson.', created_at: daysAgo(60), updated_at: daysAgo(5) },
  { id: 'contact_03', org_id: ORG_ID, first_name: 'Robert', last_name: 'Chen', email: 'robert.chen@techcorp.com', phone: '(555) 456-7890', company: 'TechCorp Office', address: '500 Innovation Drive', city: 'San Jose', state: 'CA', zip: '95110', lead_source: 'cold_call', status: 'active', property_type: 'commercial', assigned_to: 'Rep A', tags: ['commercial', 'high-value'], notes: 'Commercial office, needs access control + cameras.', created_at: daysAgo(55), updated_at: daysAgo(6) },
  { id: 'contact_04', org_id: ORG_ID, first_name: 'Sarah', last_name: 'Thompson', email: 'sarah.t@email.com', phone: '(555) 567-8901', company: null, address: '88 Maple Avenue', city: 'Denver', state: 'CO', zip: '80201', lead_source: 'website', status: 'lost', property_type: 'single_family', assigned_to: 'Rep C', tags: [], notes: 'Went with competitor on price.', created_at: daysAgo(50), updated_at: daysAgo(8) },
  { id: 'contact_05', org_id: ORG_ID, first_name: 'Michael', last_name: 'Johnson', email: 'mjohnson@email.com', phone: '(555) 678-9012', company: 'Johnson & Sons', address: '312 Pine Road', city: 'Phoenix', state: 'AZ', zip: '85001', lead_source: 'referral', status: 'active', property_type: 'commercial', assigned_to: 'Rep A', tags: ['multi-location'], notes: 'Multi-location business alarm system.', created_at: daysAgo(45), updated_at: daysAgo(3) },
  { id: 'contact_06', org_id: ORG_ID, first_name: 'Emily', last_name: 'Davis', email: 'emily.d@email.com', phone: '(555) 789-0123', company: null, address: '1567 Cedar Lane', city: 'Portland', state: 'OR', zip: '97201', lead_source: 'website', status: 'active', property_type: 'single_family', assigned_to: 'Rep B', tags: ['cameras'], notes: 'Outdoor camera system with night vision.', created_at: daysAgo(40), updated_at: daysAgo(2) },
  { id: 'contact_07', org_id: ORG_ID, first_name: 'David', last_name: 'Martinez', email: 'david.m@email.com', phone: '(555) 890-1234', company: 'Martinez Properties', address: '445 Birch Street', city: 'Miami', state: 'FL', zip: '33101', lead_source: 'partner', status: 'active', property_type: 'single_family', assigned_to: 'Rep C', tags: ['monitoring', 'rental'], notes: '24/7 monitoring for rental properties.', created_at: daysAgo(38), updated_at: daysAgo(9) },
  { id: 'contact_08', org_id: ORG_ID, first_name: 'Jennifer', last_name: 'Lee', email: 'jlee@email.com', phone: '(555) 901-2345', company: null, address: '789 Willow Way', city: 'Seattle', state: 'WA', zip: '98101', lead_source: 'website', status: 'active', property_type: 'condo', assigned_to: 'Rep A', tags: [], notes: 'Basic alarm + doorbell camera for condo.', created_at: daysAgo(35), updated_at: daysAgo(1) },
  { id: 'contact_09', org_id: ORG_ID, first_name: 'Andrew', last_name: 'Brown', email: 'andrew.b@email.com', phone: '(555) 012-3456', company: 'Brown Construction', address: '2100 Elm Boulevard', city: 'Nashville', state: 'TN', zip: '37201', lead_source: 'cold_call', status: 'active', property_type: 'commercial', assigned_to: 'Rep B', tags: ['commercial', 'temporary'], notes: 'Temporary security for active construction site.', created_at: daysAgo(32), updated_at: daysAgo(4) },
  { id: 'contact_10', org_id: ORG_ID, first_name: 'Lisa', last_name: 'Anderson', email: 'lisa.a@email.com', phone: '(555) 123-4567', company: null, address: '33 Spruce Court', city: 'Charlotte', state: 'NC', zip: '28201', lead_source: 'referral', status: 'active', property_type: 'single_family', assigned_to: 'Rep A', tags: ['full-package'], notes: 'Full security package: alarm, cameras, smart locks.', created_at: daysAgo(28), updated_at: daysAgo(2) },
  { id: 'contact_11', org_id: ORG_ID, first_name: 'Kevin', last_name: 'Patel', email: 'kevin.patel@email.com', phone: '(555) 222-3344', company: 'Patel Medical', address: '900 Health Parkway', city: 'Houston', state: 'TX', zip: '77001', lead_source: 'google_ads', status: 'new', property_type: 'commercial', assigned_to: 'Rep B', tags: ['commercial', 'medical'], notes: 'Medical office, compliance requirements for security.', created_at: daysAgo(5), updated_at: daysAgo(5) },
  { id: 'contact_12', org_id: ORG_ID, first_name: 'Rachel', last_name: 'Kim', email: 'rachel.kim@email.com', phone: '(555) 333-4455', company: null, address: '2204 Sunset Blvd', city: 'Los Angeles', state: 'CA', zip: '90028', lead_source: 'google_ads', status: 'new', property_type: 'apartment', assigned_to: 'Rep C', tags: [], notes: 'Apartment complex, wants smart lock + camera.', created_at: daysAgo(3), updated_at: daysAgo(3) },
  { id: 'contact_13', org_id: ORG_ID, first_name: 'Thomas', last_name: 'Wright', email: 'twright@email.com', phone: '(555) 444-5566', company: 'Wright Auto', address: '1050 Motor Mile', city: 'Detroit', state: 'MI', zip: '48201', lead_source: 'door_knock', status: 'active', property_type: 'commercial', assigned_to: 'Rep A', tags: ['commercial', 'auto'], notes: 'Auto dealership, exterior cameras + alarm.', created_at: daysAgo(20), updated_at: daysAgo(7) },
  { id: 'contact_14', org_id: ORG_ID, first_name: 'Amanda', last_name: 'Foster', email: 'amanda.foster@email.com', phone: '(555) 555-6677', company: null, address: '678 Lakeside Drive', city: 'Chicago', state: 'IL', zip: '60601', lead_source: 'referral', status: 'customer', property_type: 'single_family', assigned_to: 'Rep B', tags: ['monitoring', 'vip'], notes: 'Existing monitoring customer, very satisfied.', created_at: daysAgo(120), updated_at: daysAgo(15) },
  { id: 'contact_15', org_id: ORG_ID, first_name: 'Carlos', last_name: 'Rivera', email: 'carlos.r@email.com', phone: '(555) 666-7788', company: 'Rivera Restaurant Group', address: '345 Main Street', city: 'San Antonio', state: 'TX', zip: '78201', lead_source: 'partner', status: 'inactive', property_type: 'commercial', assigned_to: null, tags: ['commercial', 'restaurant'], notes: 'Paused project, may resume in Q2.', created_at: daysAgo(75), updated_at: daysAgo(30) },
]

// --- Mock Activities ---

const mockActivities: Activity[] = [
  // contact_01 - James Wilson (customer)
  { id: 'act_01', org_id: ORG_ID, contact_id: 'contact_01', deal_id: 'deal_01', type: 'deal_created', subject: 'Deal created: Wilson Home Security System', description: 'New deal worth $3,200 created from website inquiry.', performed_by: 'Rep A', performed_at: daysAgo(88), created_at: daysAgo(88) },
  { id: 'act_02', org_id: ORG_ID, contact_id: 'contact_01', deal_id: 'deal_01', type: 'call', subject: 'Initial consultation call', description: 'Discussed security needs for 3-bedroom home. Interested in full package with cameras.', performed_by: 'Rep A', performed_at: daysAgo(85), created_at: daysAgo(85) },
  { id: 'act_03', org_id: ORG_ID, contact_id: 'contact_01', deal_id: 'deal_01', type: 'site_visit', subject: 'Site assessment completed', description: 'Assessed property: 4 exterior cameras, 1 doorbell cam, motion sensors for 6 entry points, control panel in hallway.', performed_by: 'Rep A', performed_at: daysAgo(80), created_at: daysAgo(80) },
  { id: 'act_04', org_id: ORG_ID, contact_id: 'contact_01', deal_id: 'deal_01', type: 'quote_sent', subject: 'Quote sent: Pro Security Package', description: 'Sent quote for $3,200 install + $59.99/mo monitoring. 36-month contract.', performed_by: 'Rep A', performed_at: daysAgo(75), created_at: daysAgo(75) },
  { id: 'act_05', org_id: ORG_ID, contact_id: 'contact_01', deal_id: 'deal_11', type: 'stage_change', subject: 'Deal moved to Contract Signed', description: 'Wilson Monitoring Contract signed. 36-month agreement at $59.99/mo.', performed_by: 'Rep A', performed_at: daysAgo(35), created_at: daysAgo(35) },
  { id: 'act_06', org_id: ORG_ID, contact_id: 'contact_01', deal_id: null, type: 'note', subject: 'Customer satisfaction check-in', description: 'Called to follow up after 2 months. Very happy with system. Mentioned neighbor interested.', performed_by: 'Rep A', performed_at: daysAgo(10), created_at: daysAgo(10) },

  // contact_02 - Maria Garcia
  { id: 'act_07', org_id: ORG_ID, contact_id: 'contact_02', deal_id: 'deal_02', type: 'deal_created', subject: 'Deal created: Garcia Alarm Upgrade', description: 'Referral from James Wilson. Wants to upgrade existing alarm.', performed_by: 'Rep B', performed_at: daysAgo(58), created_at: daysAgo(58) },
  { id: 'act_08', org_id: ORG_ID, contact_id: 'contact_02', deal_id: 'deal_02', type: 'call', subject: 'Discovery call completed', description: 'Current system is 8 years old. Wants smart home integration.', performed_by: 'Rep B', performed_at: daysAgo(55), created_at: daysAgo(55) },
  { id: 'act_09', org_id: ORG_ID, contact_id: 'contact_02', deal_id: null, type: 'email', subject: 'Sent product brochure', description: 'Emailed smart home integration brochure and pricing overview.', performed_by: 'Rep B', performed_at: daysAgo(53), created_at: daysAgo(53) },

  // contact_03 - Robert Chen
  { id: 'act_10', org_id: ORG_ID, contact_id: 'contact_03', deal_id: 'deal_03', type: 'deal_created', subject: 'Deal created: TechCorp Office Security', description: 'Commercial opportunity from cold call. Access control + cameras.', performed_by: 'Rep A', performed_at: daysAgo(50), created_at: daysAgo(50) },
  { id: 'act_11', org_id: ORG_ID, contact_id: 'contact_03', deal_id: 'deal_03', type: 'meeting', subject: 'On-site meeting with facilities manager', description: 'Met with Robert and facilities team. 3 floors, 2 entrances, server room.', performed_by: 'Rep A', performed_at: daysAgo(45), created_at: daysAgo(45) },
  { id: 'act_12', org_id: ORG_ID, contact_id: 'contact_03', deal_id: 'deal_03', type: 'note', subject: 'Compliance requirements noted', description: 'TechCorp requires SOC2-compliant access logging. Need to verify our system capabilities.', performed_by: 'Rep A', performed_at: daysAgo(44), created_at: daysAgo(44) },

  // contact_05 - Michael Johnson
  { id: 'act_13', org_id: ORG_ID, contact_id: 'contact_05', deal_id: 'deal_05', type: 'deal_created', subject: 'Deal created: Johnson Business Alarm', description: 'Multi-location business alarm system. Referral from existing customer.', performed_by: 'Rep A', performed_at: daysAgo(42), created_at: daysAgo(42) },
  { id: 'act_14', org_id: ORG_ID, contact_id: 'contact_05', deal_id: 'deal_05', type: 'site_visit', subject: 'Site visit: Main office location', description: 'Assessed main office. Will need site visits for remaining 2 locations.', performed_by: 'Rep A', performed_at: daysAgo(38), created_at: daysAgo(38) },
  { id: 'act_15', org_id: ORG_ID, contact_id: 'contact_05', deal_id: null, type: 'task_created', subject: 'Task: Schedule remaining site visits', description: 'Need to coordinate with Johnson for visits to 2nd and 3rd locations.', performed_by: 'Rep A', performed_at: daysAgo(37), created_at: daysAgo(37) },

  // contact_11 - Kevin Patel (new)
  { id: 'act_16', org_id: ORG_ID, contact_id: 'contact_11', deal_id: null, type: 'deal_created', subject: 'New lead from Google Ads', description: 'Medical office security inquiry. Submitted form requesting consultation.', performed_by: 'System', performed_at: daysAgo(5), created_at: daysAgo(5) },
  { id: 'act_17', org_id: ORG_ID, contact_id: 'contact_11', deal_id: null, type: 'email', subject: 'Welcome email sent', description: 'Automated welcome email with company overview and service catalog.', performed_by: 'System', performed_at: daysAgo(5), created_at: daysAgo(5) },

  // contact_12 - Rachel Kim (new)
  { id: 'act_18', org_id: ORG_ID, contact_id: 'contact_12', deal_id: null, type: 'deal_created', subject: 'New lead from Google Ads', description: 'Apartment security inquiry. Interested in smart lock + camera.', performed_by: 'System', performed_at: daysAgo(3), created_at: daysAgo(3) },

  // contact_14 - Amanda Foster (customer)
  { id: 'act_19', org_id: ORG_ID, contact_id: 'contact_14', deal_id: null, type: 'call', subject: 'Monthly check-in', description: 'Routine call. System working well. Mentioned interest in adding garage sensor.', performed_by: 'Rep B', performed_at: daysAgo(15), created_at: daysAgo(15) },
  { id: 'act_20', org_id: ORG_ID, contact_id: 'contact_14', deal_id: null, type: 'note', subject: 'Upsell opportunity noted', description: 'Amanda is interested in adding a garage door sensor. Follow up next month.', performed_by: 'Rep B', performed_at: daysAgo(15), created_at: daysAgo(15) },
]

// --- Store ---

const useContactStore = create<ContactState>((set) => ({
  contacts: mockContacts,
  activities: mockActivities,
  selectedContactId: null,
  search: '',
  sourceFilter: 'all',
  statusFilter: 'all',
  sortField: 'name',
  sortDir: 'asc',
  page: 1,
  pageSize: 10,

  selectContact: (id) => set({ selectedContactId: id }),

  setSearch: (q) => set({ search: q, page: 1 }),

  setSourceFilter: (source) => set({ sourceFilter: source, page: 1 }),

  setStatusFilter: (status) => set({ statusFilter: status, page: 1 }),

  setSort: (field) =>
    set((state) => ({
      sortField: field,
      sortDir: state.sortField === field && state.sortDir === 'asc' ? 'desc' : 'asc',
      page: 1,
    })),

  setPage: (page) => set({ page }),

  addActivity: (activity) =>
    set((state) => ({
      activities: [
        {
          ...activity,
          id: `act_${Date.now()}`,
          org_id: ORG_ID,
          created_at: new Date().toISOString(),
        },
        ...state.activities,
      ],
    })),

  addContacts: (newContacts) =>
    set((state) => {
      const now = new Date().toISOString()
      const created = newContacts.map((c, i) => ({
        ...c,
        id: `contact_import_${Date.now()}_${i}`,
        org_id: ORG_ID,
        created_at: now,
        updated_at: now,
      }))
      return { contacts: [...created, ...state.contacts] }
    }),

  updateContact: (id, updates) =>
    set((state) => ({
      contacts: state.contacts.map((c) =>
        c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c,
      ),
    })),
}))

// --- Selectors ---

export function useFilteredContacts() {
  const contacts = useContactStore((s) => s.contacts)
  const search = useContactStore((s) => s.search)
  const sourceFilter = useContactStore((s) => s.sourceFilter)
  const statusFilter = useContactStore((s) => s.statusFilter)
  const sortField = useContactStore((s) => s.sortField)
  const sortDir = useContactStore((s) => s.sortDir)
  const page = useContactStore((s) => s.page)
  const pageSize = useContactStore((s) => s.pageSize)

  const q = search.toLowerCase()

  let filtered = contacts.filter((c) => {
    if (sourceFilter !== 'all' && c.lead_source !== sourceFilter) return false
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    if (q) {
      const fullName = `${c.first_name} ${c.last_name}`.toLowerCase()
      const matchesSearch =
        fullName.includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.company?.toLowerCase().includes(q) ?? false)
      if (!matchesSearch) return false
    }
    return true
  })

  // Sort
  filtered = [...filtered].sort((a, b) => {
    let cmp = 0
    switch (sortField) {
      case 'name':
        cmp = `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
        break
      case 'email':
        cmp = a.email.localeCompare(b.email)
        break
      case 'source':
        cmp = a.lead_source.localeCompare(b.lead_source)
        break
      case 'status':
        cmp = a.status.localeCompare(b.status)
        break
      case 'created_at':
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        break
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  const totalCount = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  return { contacts: paginated, totalCount, totalPages, page }
}

export default useContactStore
