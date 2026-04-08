import { create } from 'zustand'
import { contactsApi, activitiesApi } from '@/lib/api'
import type {
  Contact,
  Activity,
  LeadSource,
  ContactStatus,
} from '@/types/contact'

// --- Types ---

export type SortField = 'name' | 'email' | 'source' | 'status' | 'created_at'
export type SortDir = 'asc' | 'desc'

const SORT_FIELD_MAP: Record<SortField, string> = {
  name: 'last_name',
  email: 'email',
  source: 'lead_source',
  status: 'status',
  created_at: 'created_at',
}

interface ContactState {
  contacts: Contact[]
  activities: Activity[]
  selectedContactId: string | null
  selectedContact: Contact | null
  search: string
  sourceFilter: LeadSource | 'all'
  statusFilter: ContactStatus | 'all'
  sortField: SortField
  sortDir: SortDir
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  loading: boolean
  error: string | null

  // Actions
  fetchContacts: () => Promise<void>
  fetchContactById: (contactId: string) => Promise<Contact | null>
  fetchActivities: (contactId: string) => Promise<void>
  selectContact: (id: string | null) => void
  setSearch: (q: string) => void
  setSourceFilter: (source: LeadSource | 'all') => void
  setStatusFilter: (status: ContactStatus | 'all') => void
  setSort: (field: SortField) => void
  setPage: (page: number) => void
  createContact: (data: Partial<Contact>) => Promise<Contact>
  updateContact: (id: string, updates: Partial<Contact>) => Promise<Contact>
  deleteContact: (id: string) => Promise<void>
  addContacts: (contacts: Partial<Contact>[]) => Promise<void>
}

// --- Store ---

const useContactStore = create<ContactState>((set, get) => ({
  contacts: [],
  activities: [],
  selectedContactId: null,
  selectedContact: null,
  search: '',
  sourceFilter: 'all',
  statusFilter: 'all',
  sortField: 'created_at',
  sortDir: 'desc',
  page: 1,
  pageSize: 10,
  totalCount: 0,
  totalPages: 1,
  loading: false,
  error: null,

  fetchContacts: async () => {
    const { search, sourceFilter, statusFilter, sortField, sortDir, page, pageSize } = get()
    set({ loading: true, error: null })
    try {
      const data = await contactsApi.list({
        page,
        page_size: pageSize,
        search: search || undefined,
        lead_source: sourceFilter !== 'all' ? sourceFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        sort_by: SORT_FIELD_MAP[sortField],
        sort_dir: sortDir,
      })
      set({
        contacts: data.items,
        selectedContact: get().selectedContactId
          ? data.items.find((contact) => contact.id === get().selectedContactId) ?? get().selectedContact
          : null,
        totalCount: data.meta.total_count,
        totalPages: data.meta.total_pages,
        loading: false,
      })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to fetch contacts' })
    }
  },

  fetchContactById: async (contactId) => {
    try {
      const contact = await contactsApi.get(contactId)
      set((state) => ({
        selectedContactId: contactId,
        selectedContact: contact,
        contacts: state.contacts.some((existing) => existing.id === contact.id)
          ? state.contacts.map((existing) => existing.id === contact.id ? contact : existing)
          : [contact, ...state.contacts],
      }))
      return contact
    } catch {
      return null
    }
  },

  fetchActivities: async (contactId: string) => {
    try {
      const data = await activitiesApi.list({ contact_id: contactId, page_size: 50 })
      set({ activities: data.items })
    } catch {
      // Activities are non-critical, silently fail
    }
  },

  selectContact: (id) => set((state) => ({
    selectedContactId: id,
    selectedContact: id
      ? state.contacts.find((contact) => contact.id === id) ?? state.selectedContact
      : null,
  })),

  setSearch: (q) => {
    set({ search: q, page: 1 })
    get().fetchContacts()
  },

  setSourceFilter: (source) => {
    set({ sourceFilter: source, page: 1 })
    get().fetchContacts()
  },

  setStatusFilter: (status) => {
    set({ statusFilter: status, page: 1 })
    get().fetchContacts()
  },

  setSort: (field) => {
    const state = get()
    set({
      sortField: field,
      sortDir: state.sortField === field && state.sortDir === 'asc' ? 'desc' : 'asc',
      page: 1,
    })
    get().fetchContacts()
  },

  setPage: (page) => {
    set({ page })
    get().fetchContacts()
  },

  createContact: async (data) => {
    const contact = await contactsApi.create(data)
    get().fetchContacts()
    return contact
  },

  updateContact: async (id, updates) => {
    const contact = await contactsApi.update(id, updates)
    set((state) => ({
      contacts: state.contacts.map((c) => (c.id === id ? contact : c)),
      selectedContact: state.selectedContactId === id ? contact : state.selectedContact,
    }))
    return contact
  },

  deleteContact: async (id) => {
    await contactsApi.delete(id)
    get().fetchContacts()
  },

  addContacts: async (contacts) => {
    for (const c of contacts) {
      await contactsApi.create(c)
    }
    get().fetchContacts()
  },
}))

// --- Selectors ---

export function useFilteredContacts() {
  const contacts = useContactStore((s) => s.contacts)
  const totalCount = useContactStore((s) => s.totalCount)
  const totalPages = useContactStore((s) => s.totalPages)
  const page = useContactStore((s) => s.page)

  return { contacts, totalCount, totalPages, page }
}

export default useContactStore
