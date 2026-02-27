import { create } from 'zustand'
import type { Contract, ContractStatus, Payment } from '@/types/contract'
import usePipelineStore from './pipelineStore'
import useContactStore from './contactStore'

interface ContractState {
  contracts: Contract[]
  payments: Payment[]
  selectedContractId: string | null
  search: string
  statusFilter: ContractStatus | 'all'

  selectContract: (id: string | null) => void
  setSearch: (q: string) => void
  setStatusFilter: (status: ContractStatus | 'all') => void
  createContractFromQuote: (data: {
    deal_id: string
    contact_id: string
    quote_id: string
    title: string
    equipment_total: number
    monthly_amount: number
    term_months: number
    auto_renewal: boolean
    equipment_list: { name: string; quantity: number }[]
  }) => void
}

const ORG_ID = 'org_01'

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function dateStr(daysOffset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysOffset)
  return d.toISOString().split('T')[0]
}

const mockContracts: Contract[] = [
  {
    id: 'contract_01',
    org_id: ORG_ID,
    deal_id: 'deal_11',
    contact_id: 'contact_01',
    quote_id: 'quote_01',
    title: 'Wilson Home Security - Monitoring Agreement',
    status: 'active',
    equipment_total: 2400,
    monthly_amount: 59.99,
    term_months: 36,
    auto_renewal: true,
    start_date: dateStr(-70),
    end_date: dateStr(-70 + 365 * 3),
    equipment_list: [
      { name: 'Control Panel - Smart Hub Pro', quantity: 1 },
      { name: 'Outdoor Camera - 2K Night Vision', quantity: 4 },
      { name: 'Doorbell Camera - HD', quantity: 1 },
      { name: 'Motion Sensor - Indoor', quantity: 6 },
      { name: 'Door/Window Sensor', quantity: 8 },
    ],
    payment_method: 'Visa ending 4242',
    stripe_customer_id: 'cus_wilson_001',
    stripe_subscription_id: 'sub_wilson_001',
    signed_at: daysAgo(70),
    cancelled_at: null,
    cancellation_reason: null,
    created_at: daysAgo(70),
    updated_at: daysAgo(5),
  },
  {
    id: 'contract_02',
    org_id: ORG_ID,
    deal_id: 'deal_11',
    contact_id: 'contact_14',
    quote_id: 'quote_01',
    title: 'Foster Home Monitoring - Standard Plan',
    status: 'active',
    equipment_total: 1800,
    monthly_amount: 39.99,
    term_months: 24,
    auto_renewal: true,
    start_date: dateStr(-120),
    end_date: dateStr(-120 + 365 * 2),
    equipment_list: [
      { name: 'Control Panel - Standard', quantity: 1 },
      { name: 'Outdoor Camera - 1080p', quantity: 2 },
      { name: 'Motion Sensor - Indoor', quantity: 4 },
    ],
    payment_method: 'Mastercard ending 5555',
    stripe_customer_id: 'cus_foster_001',
    stripe_subscription_id: 'sub_foster_001',
    signed_at: daysAgo(120),
    cancelled_at: null,
    cancellation_reason: null,
    created_at: daysAgo(120),
    updated_at: daysAgo(15),
  },
]

// Generate monthly payment records
function generatePayments(contract: Contract, monthsBack: number): Payment[] {
  const payments: Payment[] = []
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    payments.push({
      id: `pay_${contract.id}_${i}`,
      org_id: ORG_ID,
      contract_id: contract.id,
      contact_id: contract.contact_id,
      amount: contract.monthly_amount,
      status: 'succeeded',
      type: 'monitoring',
      stripe_payment_id: `pi_${contract.id}_${i}`,
      failure_reason: null,
      paid_at: d.toISOString(),
      created_at: d.toISOString(),
    })
  }
  // Equipment payment
  payments.push({
    id: `pay_${contract.id}_equip`,
    org_id: ORG_ID,
    contract_id: contract.id,
    contact_id: contract.contact_id,
    amount: contract.equipment_total,
    status: 'succeeded',
    type: 'equipment',
    stripe_payment_id: `pi_${contract.id}_equip`,
    failure_reason: null,
    paid_at: contract.signed_at ?? contract.created_at,
    created_at: contract.signed_at ?? contract.created_at,
  })
  return payments
}

const mockPayments: Payment[] = [
  ...generatePayments(mockContracts[0], 2),
  ...generatePayments(mockContracts[1], 4),
]

const useContractStore = create<ContractState>((set) => ({
  contracts: mockContracts,
  payments: mockPayments,
  selectedContractId: null,
  search: '',
  statusFilter: 'all',

  selectContract: (id) => set({ selectedContractId: id }),
  setSearch: (q) => set({ search: q }),
  setStatusFilter: (status) => set({ statusFilter: status }),

  createContractFromQuote: (data) =>
    set((state) => {
      const now = new Date().toISOString()
      const startDate = new Date().toISOString().split('T')[0]
      const endDate = new Date()
      endDate.setMonth(endDate.getMonth() + data.term_months)

      const newContract: Contract = {
        id: `contract_${Date.now()}`,
        org_id: ORG_ID,
        deal_id: data.deal_id,
        contact_id: data.contact_id,
        quote_id: data.quote_id,
        title: data.title,
        status: 'active',
        equipment_total: data.equipment_total,
        monthly_amount: data.monthly_amount,
        term_months: data.term_months,
        auto_renewal: data.auto_renewal,
        start_date: startDate,
        end_date: endDate.toISOString().split('T')[0],
        equipment_list: data.equipment_list,
        payment_method: null,
        stripe_customer_id: null,
        stripe_subscription_id: null,
        signed_at: now,
        cancelled_at: null,
        cancellation_reason: null,
        created_at: now,
        updated_at: now,
      }

      // Move the associated deal to "Contract Signed" stage
      const pipelineState = usePipelineStore.getState()
      const wonStage = pipelineState.stages.find((s) => s.is_won)
      if (wonStage) {
        pipelineState.moveDeal(data.deal_id, wonStage.id)
      }

      // Log activity on contact timeline
      useContactStore.getState().addActivity({
        contact_id: data.contact_id,
        deal_id: data.deal_id,
        type: 'stage_change',
        subject: 'Contract signed: ' + data.title,
        description: `Monthly monitoring: $${data.monthly_amount}/mo for ${data.term_months} months. Equipment: $${data.equipment_total}.`,
        performed_by: 'You',
        performed_at: now,
      })

      return { contracts: [newContract, ...state.contracts] }
    }),
}))

export function useFilteredContracts() {
  const contracts = useContractStore((s) => s.contracts)
  const search = useContractStore((s) => s.search)
  const statusFilter = useContractStore((s) => s.statusFilter)

  const q = search.toLowerCase()
  return contracts.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    if (q && !c.title.toLowerCase().includes(q)) return false
    return true
  })
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
