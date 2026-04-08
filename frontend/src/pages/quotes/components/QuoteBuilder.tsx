import { useState, useEffect, useMemo } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import useQuoteStore from '@/stores/quoteStore'
import useContactStore from '@/stores/contactStore'
import usePipelineStore from '@/stores/pipelineStore'
import { useEntityLabels } from '@/hooks/useEntityLabels'
import { productsApi } from '@/lib/api'
import type { Product } from '@/lib/api'
import type { QuoteLine } from '@/types/quote'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

interface QuoteBuilderProps {
  onClose: () => void
  defaultContactId?: string
  defaultDealId?: string
}

export default function QuoteBuilder({ onClose, defaultContactId, defaultDealId }: QuoteBuilderProps) {
  const { deal: dealLabel } = useEntityLabels()
  const addQuote = useQuoteStore((s) => s.addQuote)
  const contacts = useContactStore((s) => s.contacts)
  const deals = usePipelineStore((s) => s.deals)

  const [titleOverride, setTitleOverride] = useState('')
  const [contactId, setContactId] = useState(defaultContactId ?? '')
  const [dealId, setDealId] = useState(defaultDealId ?? '')
  const [notes, setNotes] = useState('')

  // Product catalog
  const [products, setProducts] = useState<Product[]>([])
  useEffect(() => {
    productsApi.list({ is_active: true }).then((r) => setProducts(r.items)).catch(() => {})
  }, [])

  const equipmentProducts = useMemo(() => products.filter((p) => p.category !== 'monitoring'), [products])
  const monitoringProducts = useMemo(() => products.filter((p) => p.category === 'monitoring'), [products])

  // Equipment lines
  type LineItem = QuoteLine & { discount: number; productId?: string }
  const [lines, setLines] = useState<LineItem[]>([
    { id: '1', product_name: '', quantity: 1, unit_price: 0, discount: 0, total: 0 },
  ])

  // Monitoring plan
  const [monthlyAmount, setMonthlyAmount] = useState(39.99)
  const [termMonths] = useState(1)
  const [autoRenewal] = useState(true)

  const selectedContact = contacts.find((c) => c.id === contactId)
  const autoTitle = selectedContact
    ? `${selectedContact.last_name} - Security System Quote`
    : 'Security System Quote'
  const contactDeals = deals.filter((d) => d.contact_id === contactId)
  const equipmentTotal = lines.reduce((sum, l) => sum + l.total, 0)
  const totalContractValue = equipmentTotal + (monthlyAmount * termMonths)

  function addLine() {
    setLines([...lines, { id: String(Date.now()), product_name: '', quantity: 1, unit_price: 0, discount: 0, total: 0 }])
  }

  function addProductLine(product: Product) {
    setLines([...lines, {
      id: String(Date.now()),
      product_name: product.name,
      productId: product.id,
      quantity: 1,
      unit_price: product.retail_price,
      discount: 0,
      total: product.retail_price,
    }])
  }

  function removeLine(id: string) {
    if (lines.length <= 1) return
    setLines(lines.filter((l) => l.id !== id))
  }

  function updateLine(id: string, field: keyof LineItem, value: string | number) {
    setLines(lines.map((l) => {
      if (l.id !== id) return l
      const updated = { ...l, [field]: value }
      if (field === 'quantity' || field === 'unit_price' || field === 'discount') {
        const subtotal = Number(updated.quantity) * Number(updated.unit_price)
        const discountAmt = subtotal * (Number(updated.discount) / 100)
        updated.total = subtotal - discountAmt
      }
      return updated
    }))
  }

  function selectProduct(lineId: string, productId: string) {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    setLines(lines.map((l) => {
      if (l.id !== lineId) return l
      const subtotal = l.quantity * product.retail_price
      const discountAmt = subtotal * (l.discount / 100)
      return { ...l, product_name: product.name, productId: product.id, unit_price: product.retail_price, total: subtotal - discountAmt }
    }))
  }

  function selectMonitoringPlan(productId: string) {
    const plan = monitoringProducts.find((p) => p.id === productId)
    if (plan) setMonthlyAmount(plan.retail_price)
  }

  const regularTotal = lines.reduce((sum, l) => sum + (Number(l.quantity) * Number(l.unit_price)), 0)
  const totalSavings = regularTotal - equipmentTotal

  const [saving, setSaving] = useState(false)

  async function createQuote(andSend: boolean) {
    if (!contactId || !dealId) return
    setSaving(true)
    try {
      const quote = await addQuote({
        deal_id: dealId,
        contact_id: contactId,
        created_by: 'You',
        title: titleOverride.trim() || autoTitle,
        status: 'draft',
        equipment_lines: lines.filter((l) => l.product_name.trim()),
        equipment_total: equipmentTotal,
        monthly_monitoring_amount: monthlyAmount,
        contract_term_months: termMonths,
        auto_renewal: autoRenewal,
        total_contract_value: totalContractValue,
        notes: notes.trim(),
        valid_until: null,
        sent_at: null,
        accepted_at: null,
      })
      if (andSend && quote?.id) {
        const { quotesApi } = await import('@/lib/api')
        await quotesApi.send(quote.id)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    createQuote(false)
  }

  // Group equipment products by category for the picker
  const categoryLabels: Record<string, string> = {
    panel: 'Panels & Controllers',
    sensor: 'Sensors',
    camera: 'Cameras',
    smart_home: 'Smart Home',
    service: 'Services',
  }
  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {}
    equipmentProducts.forEach((p) => {
      if (!groups[p.category]) groups[p.category] = []
      groups[p.category].push(p)
    })
    return groups
  }, [equipmentProducts])

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
            <input
              type="text"
              value={titleOverride}
              onChange={(e) => setTitleOverride(e.target.value)}
              placeholder={autoTitle}
              className="text-lg font-semibold text-heading bg-transparent outline-none placeholder:text-heading/50 w-full"
            />
            <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-page hover:text-body">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-6 p-6">
            {/* Basic info */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{dealLabel.singular}</label>
                <select
                  value={dealId}
                  onChange={(e) => setDealId(e.target.value)}
                  disabled={!contactId}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-body outline-none focus:border-primary disabled:opacity-50"
                >
                  <option value="">Select {dealLabel.singularLower}...</option>
                  {contactDeals.map((d) => (
                    <option key={d.id} value={d.id}>{d.title}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick add from catalog */}
            {equipmentProducts.length > 0 && (
              <CatalogPicker
                groupedProducts={groupedProducts}
                categoryLabels={categoryLabels}
                onAdd={addProductLine}
              />
            )}

            {/* Equipment line items */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-heading">Equipment & Installation</h4>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-page/50">
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-16">Qty</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24">Price</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-20">Disc.</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24">Total</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.id} className="border-t border-border">
                        <td className="px-3 py-2">
                          {equipmentProducts.length > 0 ? (
                            <select
                              value={line.productId ?? ''}
                              onChange={(e) => {
                                if (e.target.value === '') {
                                  updateLine(line.id, 'product_name', '')
                                } else {
                                  selectProduct(line.id, e.target.value)
                                }
                              }}
                              className="w-full rounded border border-border bg-white px-2 py-1 text-sm text-heading outline-none focus:border-primary"
                            >
                              <option value="">Select product...</option>
                              {equipmentProducts.map((p) => (
                                <option key={p.id} value={p.id}>{p.name} - {currencyFormat.format(p.retail_price)}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={line.product_name}
                              onChange={(e) => updateLine(line.id, 'product_name', e.target.value)}
                              placeholder="Product name"
                              className="w-full bg-transparent text-sm text-heading outline-none placeholder:text-placeholder"
                            />
                          )}
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
                            value={line.unit_price || ''}
                            onChange={(e) => updateLine(line.id, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="w-full bg-transparent text-sm text-heading outline-none"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-0.5">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              value={line.discount || ''}
                              onChange={(e) => updateLine(line.id, 'discount', parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              className="w-full bg-transparent text-sm text-heading outline-none"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {line.discount > 0 && (
                            <span className="text-[10px] text-muted-foreground line-through mr-1">
                              {currencyFormat.format(Number(line.quantity) * Number(line.unit_price))}
                            </span>
                          )}
                          <span className="text-sm font-medium text-heading">
                            {currencyFormat.format(line.total)}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <button type="button" onClick={() => removeLine(line.id)} className="rounded p-1 text-muted-foreground hover:text-danger">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-page/30">
                      <td colSpan={4} className="px-3 py-2">
                        <button type="button" onClick={addLine} className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover">
                          <Plus className="h-3.5 w-3.5" /> Add line item
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

            {/* Monthly Monitoring */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-heading">Monthly Monitoring</h4>
              <div className="rounded-lg border border-border p-4">
                {monitoringProducts.length > 0 ? (
                  <div className="space-y-2">
                    {monitoringProducts.map((plan) => (
                      <label key={plan.id} className={`flex items-center justify-between rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                        Math.abs(monthlyAmount - plan.retail_price) < 0.01 ? 'border-primary bg-primary/5' : 'border-border hover:bg-page'
                      }`}>
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="monitoring"
                            checked={Math.abs(monthlyAmount - plan.retail_price) < 0.01}
                            onChange={() => selectMonitoringPlan(plan.id)}
                            className="accent-primary"
                          />
                          <div>
                            <p className="text-sm font-medium text-heading">{plan.name}</p>
                            {plan.description && <p className="text-[10px] text-muted-foreground">{plan.description}</p>}
                          </div>
                        </div>
                        <span className="text-sm font-bold text-primary">{currencyFormat.format(plan.retail_price)}/mo</span>
                      </label>
                    ))}
                    <label className={`flex items-center justify-between rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                      !monitoringProducts.some((p) => Math.abs(monthlyAmount - p.retail_price) < 0.01) ? 'border-primary bg-primary/5' : 'border-border hover:bg-page'
                    }`}>
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="monitoring"
                          checked={!monitoringProducts.some((p) => Math.abs(monthlyAmount - p.retail_price) < 0.01)}
                          onChange={() => setMonthlyAmount(0)}
                          className="accent-primary"
                        />
                        <span className="text-sm font-medium text-heading">Custom amount</span>
                      </div>
                      <div className="relative w-24">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={!monitoringProducts.some((p) => Math.abs(monthlyAmount - p.retail_price) < 0.01) ? (monthlyAmount || '') : ''}
                          onChange={(e) => setMonthlyAmount(parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="w-full rounded border border-border pl-5 pr-2 py-1 text-xs text-heading outline-none focus:border-primary"
                        />
                      </div>
                    </label>
                  </div>
                ) : (
                  <div className="max-w-xs">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Monthly Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={monthlyAmount || ''}
                        onChange={(e) => setMonthlyAmount(parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border border-border bg-white pl-7 pr-3 py-2 text-sm text-heading outline-none focus:border-primary"
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">Month-to-month, auto-renewing</p>
                  </div>
                )}
              </div>
            </div>

            {/* Totals summary */}
            <div className="rounded-lg bg-primary/5 p-4">
              {totalSavings > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-body">Regular Price</span>
                  <span className="text-sm text-muted-foreground line-through">{currencyFormat.format(regularTotal)}</span>
                </div>
              )}
              {totalSavings > 0 && (
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-success">You Save</span>
                  <span className="text-sm font-medium text-success">-{currencyFormat.format(totalSavings)}</span>
                </div>
              )}
              <div className={`flex items-center justify-between ${totalSavings > 0 ? 'mt-1 pt-1 border-t border-primary/10' : ''}`}>
                <span className="text-sm text-body">Equipment / Install</span>
                <span className="text-sm font-medium text-heading">{currencyFormat.format(equipmentTotal)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-sm text-body">Monthly Monitoring</span>
                <span className="text-sm font-medium text-heading">{currencyFormat.format(monthlyAmount)}/mo</span>
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
              disabled={saving || !contactId || !dealId}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-heading hover:bg-page disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save as Draft'}
            </button>
            <button
              type="button"
              onClick={() => createQuote(true)}
              disabled={saving || !contactId || !dealId}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {saving ? 'Sending...' : 'Create & Send'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

function CatalogPicker({ groupedProducts, categoryLabels, onAdd }: {
  groupedProducts: Record<string, Product[]>
  categoryLabels: Record<string, string>
  onAdd: (product: Product) => void
}) {
  const [openCat, setOpenCat] = useState<string | null>(null)

  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add from Catalog</h4>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(groupedProducts).map(([cat, prods]) => (
          <div key={cat} className="relative">
            <button
              type="button"
              onClick={() => setOpenCat(openCat === cat ? null : cat)}
              className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                openCat === cat ? 'border-primary bg-primary/5 text-primary' : 'border-border text-heading hover:bg-page'
              }`}
            >
              {categoryLabels[cat] ?? cat} ({prods.length})
            </button>
            {openCat === cat && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setOpenCat(null)} />
                <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border border-border bg-white shadow-dropdown">
                  {prods.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { onAdd(p); setOpenCat(null) }}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs hover:bg-page border-b border-border last:border-b-0"
                    >
                      <div>
                        <p className="font-medium text-heading">{p.name}</p>
                        {p.sku && <p className="text-[10px] text-muted-foreground">{p.sku}</p>}
                      </div>
                      <span className="font-bold text-primary">{currencyFormat.format(p.retail_price)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
