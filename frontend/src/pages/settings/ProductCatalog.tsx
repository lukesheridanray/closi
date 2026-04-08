import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2, Package, Loader2 } from 'lucide-react'
import { productsApi } from '@/lib/api'
import type { Product } from '@/lib/api'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

const categoryLabels: Record<string, string> = {
  panel: 'Panels & Controllers',
  sensor: 'Sensors',
  camera: 'Cameras',
  smart_home: 'Smart Home',
  service: 'Services',
  monitoring: 'Monitoring Plans',
  other: 'Other',
}

const categoryOrder = ['panel', 'sensor', 'camera', 'smart_home', 'service', 'monitoring', 'other']

export default function ProductCatalog() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => { loadProducts() }, [])

  async function loadProducts() {
    setLoading(true)
    try {
      const data = await productsApi.list()
      setProducts(data.items)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!editingProduct?.name) return
    setSaving(true)
    try {
      if (editingProduct.id) {
        await productsApi.update(editingProduct.id, editingProduct)
      } else {
        await productsApi.create(editingProduct)
      }
      setEditingProduct(null)
      loadProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await productsApi.delete(id)
      loadProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product')
    }
  }

  async function handleSeed() {
    setSeeding(true)
    try {
      await productsApi.seed()
      loadProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seed products')
    } finally {
      setSeeding(false)
    }
  }

  // Group products by category
  const grouped = products.reduce<Record<string, Product[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = []
    acc[p.category].push(p)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/settings')} className="rounded-lg p-1.5 text-muted-foreground hover:bg-page hover:text-heading">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-heading">Product Catalog</h1>
            <p className="text-sm text-muted-foreground">Equipment, services, and monitoring plans for quotes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {products.length === 0 && !loading && (
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-heading hover:bg-page disabled:opacity-50"
            >
              {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
              Load Default Products
            </button>
          )}
          <button
            onClick={() => setEditingProduct({ name: '', category: 'other', unit_cost: 0, retail_price: 0, is_active: true })}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            <Plus className="h-4 w-4" /> Add Product
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-2.5 text-sm text-danger">{error}</div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          <Loader2 className="inline h-4 w-4 animate-spin mr-2" />Loading products...
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-heading">No products yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add products or load the default Medley & Sons catalog.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {categoryOrder.filter((cat) => grouped[cat]?.length).map((cat) => (
            <div key={cat}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {categoryLabels[cat] ?? cat} ({grouped[cat].length})
              </h2>
              <div className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-page/60">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2.5">Product</th>
                      <th className="px-4 py-2.5 w-20">SKU</th>
                      <th className="px-4 py-2.5 w-24 text-right">Cost</th>
                      <th className="px-4 py-2.5 w-24 text-right">Price</th>
                      <th className="px-4 py-2.5 w-20 text-right">Margin</th>
                      <th className="px-4 py-2.5 w-24" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {grouped[cat].map((p) => {
                      const margin = p.retail_price > 0 ? ((p.retail_price - p.unit_cost) / p.retail_price * 100) : 0
                      return (
                        <tr key={p.id} className="hover:bg-page/30">
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-heading">{p.name}</p>
                            {p.description && <p className="text-[10px] text-muted-foreground mt-0.5">{p.description}</p>}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{p.sku ?? '--'}</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground">{currencyFormat.format(p.unit_cost)}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-heading">{currencyFormat.format(p.retail_price)}</td>
                          <td className="px-4 py-2.5 text-right text-xs">
                            <span className={margin >= 50 ? 'text-success' : margin >= 30 ? 'text-heading' : 'text-warning'}>
                              {margin.toFixed(0)}%
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => setEditingProduct(p)} className="rounded p-1 text-muted-foreground hover:text-heading hover:bg-page">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => handleDelete(p.id)} className="rounded p-1 text-muted-foreground hover:text-danger hover:bg-danger/5">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create modal */}
      {editingProduct && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setEditingProduct(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-modal p-5 space-y-4">
              <h3 className="text-sm font-semibold text-heading">{editingProduct.id ? 'Edit Product' : 'New Product'}</h3>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">Name *</label>
                  <input type="text" value={editingProduct.name ?? ''} onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-heading outline-none focus:border-primary" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">SKU</label>
                    <input type="text" value={editingProduct.sku ?? ''} onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-heading outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Category</label>
                    <select value={editingProduct.category ?? 'other'} onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-heading outline-none focus:border-primary">
                      {Object.entries(categoryLabels).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">Description</label>
                  <input type="text" value={editingProduct.description ?? ''} onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-heading outline-none focus:border-primary" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Cost</label>
                    <input type="number" min={0} step={0.01} value={editingProduct.unit_cost ?? 0} onChange={(e) => setEditingProduct({ ...editingProduct, unit_cost: parseFloat(e.target.value) || 0 })}
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-heading outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Retail Price</label>
                    <input type="number" min={0} step={0.01} value={editingProduct.retail_price ?? 0} onChange={(e) => setEditingProduct({ ...editingProduct, retail_price: parseFloat(e.target.value) || 0 })}
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-heading outline-none focus:border-primary" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setEditingProduct(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-page">Cancel</button>
                <button onClick={handleSave} disabled={saving || !editingProduct.name}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
