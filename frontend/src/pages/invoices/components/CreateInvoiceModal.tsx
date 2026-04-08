import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import useInvoiceStore from '@/stores/invoiceStore'
import useContractStore from '@/stores/contractStore'
import useContactStore from '@/stores/contactStore'
import type { InvoiceLine } from '@/types/invoice'

interface CreateInvoiceModalProps {
  open: boolean
  onClose: () => void
}

const emptyLine: InvoiceLine = { description: '', quantity: 1, unit_price: 0, amount: 0 }

export default function CreateInvoiceModal({ open, onClose }: CreateInvoiceModalProps) {
  const createInvoice = useInvoiceStore((s) => s.createInvoice)
  const contracts = useContractStore((s) => s.contracts)
  const contacts = useContactStore((s) => s.contacts)

  const activeContracts = contracts.filter((c) => c.status === 'active')
  const contactMap = new Map(contacts.map((c) => [c.id, c]))

  const [contractId, setContractId] = useState('')
  const [invoiceKind, setInvoiceKind] = useState<'recurring' | 'one_time'>('recurring')
  const [lineItems, setLineItems] = useState<InvoiceLine[]>([{ ...emptyLine }])
  const [taxRate, setTaxRate] = useState(8.25)
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().split('T')[0]
  })
  const [notes, setNotes] = useState('')

  if (!open) return null

  const selectedContract = activeContracts.find((c) => c.id === contractId)

  function handleContractChange(id: string) {
    setContractId(id)
    const contract = activeContracts.find((c) => c.id === id)
    if (contract) {
      if (invoiceKind === 'recurring') {
        setLineItems([
          { description: `Monthly Security Monitoring`, quantity: 1, unit_price: contract.monthly_amount, amount: contract.monthly_amount },
        ])
      } else {
        const eqLines = contract.equipment_lines ?? []
        setLineItems(
          eqLines.map((eq) => ({
            description: eq.name,
            quantity: eq.quantity,
            unit_price: 0,
            amount: 0,
          })),
        )
      }
    }
  }

  function handleTypeChange(newType: 'recurring' | 'one_time') {
    setInvoiceKind(newType)
    if (selectedContract) {
      if (newType === 'recurring') {
        setLineItems([
          { description: 'Monthly Security Monitoring', quantity: 1, unit_price: selectedContract.monthly_amount, amount: selectedContract.monthly_amount },
        ])
      } else {
        const eqLines = selectedContract.equipment_lines ?? []
        setLineItems(
          eqLines.map((eq) => ({
            description: eq.name,
            quantity: eq.quantity,
            unit_price: 0,
            amount: 0,
          })),
        )
      }
    }
  }

  function updateLine(index: number, field: keyof InvoiceLine, value: string | number) {
    setLineItems((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line
        const updated = { ...line, [field]: value }
        if (field === 'quantity' || field === 'unit_price') {
          updated.amount = Number(updated.quantity) * Number(updated.unit_price)
        }
        return updated
      }),
    )
  }

  function addLine() {
    setLineItems((prev) => [...prev, { ...emptyLine }])
  }

  function removeLine(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index))
  }

  const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0)
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100
  const total = subtotal + taxAmount

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!contractId || lineItems.length === 0) return

    const contact = selectedContract
      ? selectedContract.contact_id
      : ''

    createInvoice({
      contract_id: contractId,
      contact_id: contact,
      line_items: lineItems,
      subtotal,
      tax_amount: taxAmount,
      total,
      due_date: dueDate,
      memo: notes || undefined,
    })
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-x-4 top-[5%] z-50 mx-auto max-w-2xl rounded-xl bg-white shadow-modal sm:inset-x-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-heading">Create Invoice</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-page hover:text-body">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="max-h-[75vh] overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {/* Contract selector */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Agreement</label>
              <select
                value={contractId}
                onChange={(e) => handleContractChange(e.target.value)}
                required
                className="w-full rounded-lg border-b-2 border-border bg-transparent px-3 py-2 text-sm text-heading focus:border-primary focus:outline-none"
              >
                <option value="">Select agreement...</option>
                {activeContracts.map((c) => {
                  const contact = contactMap.get(c.contact_id)
                  return (
                    <option key={c.id} value={c.id}>
                      {contact ? `${contact.first_name} ${contact.last_name}` : c.title} - {c.title}
                    </option>
                  )
                })}
              </select>
            </div>

            {/* Type (local-only for pre-filling line items) */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Invoice Type</label>
              <div className="flex gap-2">
                {(['recurring', 'one_time'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTypeChange(t)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      invoiceKind === t
                        ? 'bg-primary text-white'
                        : 'border border-border bg-white text-body hover:bg-page'
                    }`}
                  >
                    {t === 'recurring' ? 'Recurring' : 'One-Time'}
                  </button>
                ))}
              </div>
            </div>

            {/* Line Items */}
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">Line Items</label>
              <div className="space-y-2">
                {lineItems.map((line, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={line.description}
                      onChange={(e) => updateLine(i, 'description', e.target.value)}
                      placeholder="Description"
                      required
                      className="flex-1 rounded-lg border-b-2 border-border bg-transparent px-3 py-2 text-sm text-heading focus:border-primary focus:outline-none"
                    />
                    <input
                      type="number"
                      value={line.quantity}
                      onChange={(e) => updateLine(i, 'quantity', Number(e.target.value))}
                      min={1}
                      className="w-16 rounded-lg border-b-2 border-border bg-transparent px-2 py-2 text-right text-sm text-heading focus:border-primary focus:outline-none"
                    />
                    <input
                      type="number"
                      value={line.unit_price}
                      onChange={(e) => updateLine(i, 'unit_price', Number(e.target.value))}
                      min={0}
                      step={0.01}
                      className="w-24 rounded-lg border-b-2 border-border bg-transparent px-2 py-2 text-right text-sm text-heading focus:border-primary focus:outline-none"
                    />
                    <span className="w-20 text-right text-sm font-medium text-heading">${line.amount.toFixed(2)}</span>
                    {lineItems.length > 1 && (
                      <button type="button" onClick={() => removeLine(i)} className="p-1 text-muted-foreground hover:text-danger">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addLine}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Line
              </button>
            </div>

            {/* Tax + Due Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Tax Rate (%)</label>
                <input
                  type="number"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  min={0}
                  max={30}
                  step={0.01}
                  className="w-full rounded-lg border-b-2 border-border bg-transparent px-3 py-2 text-sm text-heading focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  className="w-full rounded-lg border-b-2 border-border bg-transparent px-3 py-2 text-sm text-heading focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border-b-2 border-border bg-transparent px-3 py-2 text-sm text-heading focus:border-primary focus:outline-none"
              />
            </div>

            {/* Totals summary */}
            <div className="rounded-lg border border-border p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-body">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax ({taxRate}%)</span>
                <span className="text-body">${taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1 text-sm">
                <span className="font-bold text-heading">Total</span>
                <span className="font-bold text-primary">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-body hover:bg-page">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!contractId || lineItems.length === 0}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              Create Invoice
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
