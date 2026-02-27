import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import useQuoteStore from '@/stores/quoteStore'
import useContactStore from '@/stores/contactStore'
import usePipelineStore from '@/stores/pipelineStore'
import type { QuoteLine } from '@/types/quote'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

interface QuoteBuilderProps {
  onClose: () => void
}

export default function QuoteBuilder({ onClose }: QuoteBuilderProps) {
  const addQuote = useQuoteStore((s) => s.addQuote)
  const contacts = useContactStore((s) => s.contacts)
  const deals = usePipelineStore((s) => s.deals)

  const [title, setTitle] = useState('')
  const [contactId, setContactId] = useState('')
  const [dealId, setDealId] = useState('')
  const [notes, setNotes] = useState('')

  // Equipment lines
  const [lines, setLines] = useState<QuoteLine[]>([
    { id: '1', product_name: '', quantity: 1, unit_price: 0, total: 0 },
  ])

  // Monitoring plan
  const [monthlyAmount, setMonthlyAmount] = useState(39.99)
  const [termMonths, setTermMonths] = useState(36)
  const [autoRenewal, setAutoRenewal] = useState(true)

  const contactDeals = deals.filter((d) => d.contact_id === contactId)
  const equipmentTotal = lines.reduce((sum, l) => sum + l.total, 0)
  const totalContractValue = equipmentTotal + (monthlyAmount * termMonths)

  function addLine() {
    setLines([...lines, { id: String(Date.now()), product_name: '', quantity: 1, unit_price: 0, total: 0 }])
  }

  function removeLine(id: string) {
    if (lines.length <= 1) return
    setLines(lines.filter((l) => l.id !== id))
  }

  function updateLine(id: string, field: keyof QuoteLine, value: string | number) {
    setLines(lines.map((l) => {
      if (l.id !== id) return l
      const updated = { ...l, [field]: value }
      if (field === 'quantity' || field === 'unit_price') {
        updated.total = Number(updated.quantity) * Number(updated.unit_price)
      }
      return updated
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !contactId || !dealId) return

    addQuote({
      deal_id: dealId,
      contact_id: contactId,
      created_by: 'You',
      title: title.trim(),
      status: 'draft',
      equipment_lines: lines.filter((l) => l.product_name.trim()),
      equipment_total: equipmentTotal,
      monitoring: { monthly_amount: monthlyAmount, term_months: termMonths, auto_renewal: autoRenewal },
      total_contract_value: totalContractValue,
      notes: notes.trim(),
      valid_until: null,
      sent_at: null,
      accepted_at: null,
    })
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-x-0 top-[5%] bottom-[5%] z-50 mx-auto w-full max-w-3xl overflow-y-auto">
        <form
          onSubmit={handleSubmit}
          className="mx-4 rounded-2xl bg-white shadow-modal"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white px-6 py-4 rounded-t-2xl">
            <h3 className="text-lg font-semibold text-heading">Create Quote</h3>
            <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-page hover:text-body">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-6 p-6">
            {/* Basic info */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Quote Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Smith Home - Pro Security Package"
                  autoFocus
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-heading outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Contact</label>
                <select
                  value={contactId}
                  onChange={(e) => { setContactId(e.target.value); setDealId('') }}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-body outline-none focus:border-primary"
                >
                  <option value="">Select contact...</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Deal</label>
                <select
                  value={dealId}
                  onChange={(e) => setDealId(e.target.value)}
                  disabled={!contactId}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-body outline-none focus:border-primary disabled:opacity-50"
                >
                  <option value="">Select deal...</option>
                  {contactDeals.map((d) => (
                    <option key={d.id} value={d.id}>{d.title}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Equipment line items */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-heading">Equipment & Installation</h4>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-page/50">
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-20">Qty</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-28">Unit Price</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground w-28">Total</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.id} className="border-t border-border">
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={line.product_name}
                            onChange={(e) => updateLine(line.id, 'product_name', e.target.value)}
                            placeholder="Product name"
                            className="w-full bg-transparent text-sm text-heading outline-none placeholder:text-placeholder"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={(e) => updateLine(line.id, 'quantity', parseInt(e.target.value) || 0)}
                            className="w-full bg-transparent text-sm text-heading outline-none"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={line.unit_price}
                            onChange={(e) => updateLine(line.id, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="w-full bg-transparent text-sm text-heading outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-sm font-medium text-heading">
                          {currencyFormat.format(line.total)}
                        </td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => removeLine(line.id)}
                            className="rounded p-1 text-muted-foreground hover:text-danger"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-page/30">
                      <td colSpan={3} className="px-3 py-2">
                        <button
                          type="button"
                          onClick={addLine}
                          className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add line item
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-bold text-heading">
                        {currencyFormat.format(equipmentTotal)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Monitoring plan */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-heading">Monitoring Plan</h4>
              <div className="grid grid-cols-3 gap-4 rounded-lg border border-border p-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Monthly Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={monthlyAmount}
                      onChange={(e) => setMonthlyAmount(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-border bg-white pl-7 pr-3 py-2 text-sm text-heading outline-none focus:border-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Contract Term</label>
                  <select
                    value={termMonths}
                    onChange={(e) => setTermMonths(parseInt(e.target.value))}
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-body outline-none focus:border-primary"
                  >
                    <option value={12}>12 months</option>
                    <option value={24}>24 months</option>
                    <option value={36}>36 months</option>
                    <option value={60}>60 months</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-body">
                    <input
                      type="checkbox"
                      checked={autoRenewal}
                      onChange={(e) => setAutoRenewal(e.target.checked)}
                      className="accent-primary h-4 w-4 rounded"
                    />
                    Auto-renewal
                  </label>
                </div>
              </div>
            </div>

            {/* Totals summary */}
            <div className="rounded-lg bg-primary/5 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-body">Equipment Total</span>
                <span className="text-sm font-medium text-heading">{currencyFormat.format(equipmentTotal)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-sm text-body">Monthly Monitoring</span>
                <span className="text-sm font-medium text-heading">{currencyFormat.format(monthlyAmount)}/mo x {termMonths} mo</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-primary/10 pt-2">
                <span className="text-sm font-semibold text-heading">Total Contract Value</span>
                <span className="text-lg font-bold text-primary">{currencyFormat.format(totalContractValue)}</span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={2}
                className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm text-body outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-white px-6 py-4 rounded-b-2xl">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-page">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !contactId || !dealId}
              className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              Create Quote
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
