import { create } from 'zustand'
import { contractsApi, paymentsApi } from '@/lib/api'
import type { Contract, ContractStatus, Payment } from '@/types/contract'

interface ContractState {
  contracts: Contract[]
  payments: Payment[]
  selectedContractId: string | null
  search: string
  statusFilter: ContractStatus | 'all'
  loading: boolean
  error: string | null

  fetchContracts: () => Promise<void>
  fetchPayments: (params?: { contract_id?: string; contact_id?: string }) => Promise<void>
  selectContract: (id: string | null) => void
  setSearch: (q: string) => void
  setStatusFilter: (status: ContractStatus | 'all') => void
  createContract: (data: Partial<Contract>) => Promise<Contract>
}

const useContractStore = create<ContractState>((set, get) => ({
  contracts: [],
  payments: [],
  selectedContractId: null,
  search: '',
  statusFilter: 'all',
  loading: false,
  error: null,

  fetchContracts: async () => {
    const { search, statusFilter } = get()
    set({ loading: true, error: null })
    try {
      const data = await contractsApi.list({
        page_size: 100,
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      })
      set({ contracts: data.items, loading: false })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to fetch agreements' })
    }
  },

  fetchPayments: async (params) => {
    try {
      const data = await paymentsApi.list({ page_size: 100, ...params })
      set({ payments: data.items })
    } catch {
      // Payments are supplementary, silently fail
    }
  },

  selectContract: (id) => set({ selectedContractId: id }),

  setSearch: (q) => {
    set({ search: q })
    get().fetchContracts()
  },

  setStatusFilter: (status) => {
    set({ statusFilter: status })
    get().fetchContracts()
  },

  createContract: async (data) => {
    const contract = await contractsApi.create(data)
    set((state) => ({ contracts: [contract, ...state.contracts] }))
    return contract
  },
}))

export function useFilteredContracts() {
  return useContractStore((s) => s.contracts)
}

export function useContractsForContact(contactId: string) {
  const contracts = useContractStore((s) => s.contracts)
  return contracts.filter((c) => c.contact_id === contactId)
}

export function usePaymentsForContract(contractId: string) {
  const payments = useContractStore((s) => s.payments)
  return payments.filter((p) => p.contract_id === contractId)
}

export function usePaymentsForContact(contactId: string) {
  const payments = useContractStore((s) => s.payments)
  return payments.filter((p) => p.contact_id === contactId)
}

export function useMRR() {
  const contracts = useContractStore((s) => s.contracts)
  return contracts
    .filter((c) => c.status === 'active')
    .reduce((sum, c) => sum + c.monthly_amount, 0)
}

export default useContractStore
