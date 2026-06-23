'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { fmt, fmtDate } from '../../lib/utils';
import toast from 'react-hot-toast';
import { Plus, Package, AlertTriangle, ShoppingCart, Users, TrendingDown } from 'lucide-react';

const poStatusColor: Record<string, string> = {
  DRAFT: 'badge-gray', SENT: 'badge-blue', CONFIRMED: 'badge-blue',
  PARTIALLY_RECEIVED: 'badge-yellow', RECEIVED: 'badge-green', CANCELLED: 'badge-red',
};
const stockColor = (s: string) => s === 'OUT_OF_STOCK' ? 'badge-red' : s === 'LOW_STOCK' ? 'badge-yellow' : 'badge-green';

export default function SupplyChainPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'inventory' | 'vendors' | 'orders'>('inventory');
  const [showCreatePO, setShowCreatePO] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<any>(null);

  const { data: summary } = useQuery({ queryKey: ['sc-summary'], queryFn: () => api.get('/api/v1/supply-chain/summary') });
  const { data: inventory, isLoading: invLoading } = useQuery({ queryKey: ['inventory'], queryFn: () => api.get('/api/v1/supply-chain/inventory') });
  const { data: vendors } = useQuery({ queryKey: ['vendors'], queryFn: () => api.get('/api/v1/supply-chain/vendors') });
  const { data: orders } = useQuery({ queryKey: ['purchase-orders'], queryFn: () => api.get('/api/v1/supply-chain/purchase-orders') });

  const updatePO = useMutation({
    mutationFn: ({ id, status }: any) => api.patch(`/api/v1/supply-chain/purchase-orders/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-orders'] }); qc.invalidateQueries({ queryKey: ['inventory'] }); toast.success('Order updated'); },
    onError: (e: any) => toast.error(e?.message || 'Failed to update order'),
  });

  const s = summary as any;
  const inv = (inventory as any[]) || [];
  const vends = (vendors as any[]) || [];
  const pos = (orders as any[]) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1>Supply Chain</h1>
          <p className="text-slate-500 text-sm mt-0.5">Inventory, vendors & purchase orders</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddProduct(true)} className="btn-secondary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Product
          </button>
          <button onClick={() => setShowCreatePO(true)} className="btn-primary flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" /> New PO
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Products', value: s?.totalProducts || 0, icon: Package, color: 'bg-blue-600' },
          { label: 'Low Stock Items', value: s?.lowStockItems || 0, icon: AlertTriangle, color: s?.lowStockItems > 0 ? 'bg-orange-500' : 'bg-slate-400' },
          { label: 'Pending Orders', value: s?.pendingOrders || 0, icon: ShoppingCart, color: 'bg-purple-600' },
          { label: 'Active Vendors', value: s?.totalVendors || 0, icon: Users, color: 'bg-teal-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
              <Icon className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-xl font-bold text-slate-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="flex border-b border-slate-200">
          {[['inventory', 'Inventory'], ['vendors', 'Vendors'], ['orders', 'Purchase Orders']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id as any)}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Inventory */}
        {tab === 'inventory' && (
          <div>
            <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center">
              <p className="text-xs text-slate-500">{inv.length} products tracked</p>
              <a href={`${process.env.NEXT_PUBLIC_API_URL}/api/v1/export/inventory`} className="btn-secondary text-xs py-1.5" download>↓ Export CSV</a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                    {['SKU', 'Product', 'Category', 'On Hand', 'Reserved', 'Reorder Point', 'Status', 'Action'].map(h => (
                      <th key={h} className="px-5 py-3 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invLoading && [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-slate-100 animate-pulse">
                      {[...Array(8)].map((_, j) => <td key={j} className="px-5 py-3"><div className="h-3 bg-slate-100 rounded w-20" /></td>)}
                    </tr>
                  ))}
                  {!invLoading && inv.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-10 text-slate-400">No inventory items. Add a product to get started.</td></tr>
                  )}
                  {inv.map((item: any) => (
                    <tr key={item.id} className="table-row">
                      <td className="px-5 py-3 font-mono text-xs text-slate-500">{item.product.sku}</td>
                      <td className="px-5 py-3 font-medium text-slate-800">{item.product.name}</td>
                      <td className="px-5 py-3 text-slate-500">{item.product.category || '—'}</td>
                      <td className="px-5 py-3 font-bold">{item.quantityOnHand}</td>
                      <td className="px-5 py-3 text-slate-500">{item.quantityReserved}</td>
                      <td className="px-5 py-3 text-slate-500">{item.product.reorderPoint}</td>
                      <td className="px-5 py-3"><span className={stockColor(item.status)}>{item.status?.replace('_', ' ')}</span></td>
                      <td className="px-5 py-3">
                        <button onClick={() => setAdjustingProduct(item)} className="text-xs text-blue-600 hover:underline font-medium">Adjust Stock</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Vendors */}
        {tab === 'vendors' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  {['Code', 'Vendor Name', 'Email', 'Payment Terms', 'Currency', 'Status'].map(h => (
                    <th key={h} className="px-5 py-3 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vends.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-slate-400">No vendors yet.</td></tr>}
                {vends.map((v: any) => (
                  <tr key={v.id} className="table-row">
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{v.code}</td>
                    <td className="px-5 py-3 font-medium text-slate-800">{v.name}</td>
                    <td className="px-5 py-3 text-slate-500">{v.email || '—'}</td>
                    <td className="px-5 py-3">{v.paymentTerms} days</td>
                    <td className="px-5 py-3">{v.currency}</td>
                    <td className="px-5 py-3"><span className={v.isActive ? 'badge-green' : 'badge-gray'}>{v.isActive ? 'Active' : 'Inactive'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Purchase Orders */}
        {tab === 'orders' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  {['PO Number', 'Vendor', 'Order Date', 'Total', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pos.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-slate-400">No purchase orders yet.</td></tr>}
                {pos.map((po: any) => (
                  <tr key={po.id} className="table-row">
                    <td className="px-5 py-3 font-mono font-semibold text-blue-600">{po.poNumber}</td>
                    <td className="px-5 py-3 font-medium">{po.vendor?.name}</td>
                    <td className="px-5 py-3 text-slate-500">{fmtDate(po.orderDate)}</td>
                    <td className="px-5 py-3 font-semibold">{fmt(po.totalAmount)}</td>
                    <td className="px-5 py-3"><span className={poStatusColor[po.status] || 'badge-gray'}>{po.status}</span></td>
                    <td className="px-5 py-3 flex gap-2">
                      {po.status === 'DRAFT' && (
                        <button onClick={() => updatePO.mutate({ id: po.id, status: 'SENT' })} className="text-xs text-blue-600 hover:underline font-medium">Send</button>
                      )}
                      {po.status === 'SENT' && (
                        <button onClick={() => updatePO.mutate({ id: po.id, status: 'CONFIRMED' })} className="text-xs text-blue-600 hover:underline font-medium">Confirm</button>
                      )}
                      {po.status === 'CONFIRMED' && (
                        <button onClick={() => updatePO.mutate({ id: po.id, status: 'RECEIVED' })} className="text-xs text-green-600 hover:underline font-medium">Mark Received</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreatePO && (
        <CreatePOModal
          vendors={vends}
          products={inv.map((i: any) => i.product)}
          onClose={() => setShowCreatePO(false)}
          onSuccess={() => { setShowCreatePO(false); qc.invalidateQueries({ queryKey: ['purchase-orders'] }); }}
        />
      )}
      {showAddProduct && (
        <AddProductModal
          onClose={() => setShowAddProduct(false)}
          onSuccess={() => { setShowAddProduct(false); qc.invalidateQueries({ queryKey: ['inventory'] }); qc.invalidateQueries({ queryKey: ['sc-summary'] }); }}
        />
      )}
      {adjustingProduct && (
        <AdjustStockModal
          item={adjustingProduct}
          onClose={() => setAdjustingProduct(null)}
          onSuccess={() => { setAdjustingProduct(null); qc.invalidateQueries({ queryKey: ['inventory'] }); qc.invalidateQueries({ queryKey: ['sc-summary'] }); }}
        />
      )}
    </div>
  );
}

function AddProductModal({ onClose, onSuccess }: any) {
  const [form, setForm] = useState({ name: '', sku: '', category: '', unit: 'PCS', costPrice: '', sellPrice: '', reorderPoint: '10', initialStock: '0' });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/api/v1/supply-chain/products', data),
    onSuccess: () => { toast.success('Product added!'); onSuccess(); },
    onError: (e: any) => toast.error(e?.message || 'Failed to add product'),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b">
          <h2>Add Product</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
        </div>
        <form onSubmit={e => { e.preventDefault(); mutation.mutate({ ...form, costPrice: parseFloat(form.costPrice), sellPrice: parseFloat(form.sellPrice), reorderPoint: parseInt(form.reorderPoint), initialStock: parseInt(form.initialStock) }); }} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Product Name</label><input value={form.name} onChange={e => set('name', e.target.value)} className="input" required /></div>
            <div><label className="label">SKU</label><input value={form.sku} onChange={e => set('sku', e.target.value)} className="input" placeholder="e.g. PRD006" required /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Category</label><input value={form.category} onChange={e => set('category', e.target.value)} className="input" placeholder="e.g. Electronics" /></div>
            <div><label className="label">Unit</label>
              <select value={form.unit} onChange={e => set('unit', e.target.value)} className="input">
                {['PCS', 'KG', 'L', 'BOX', 'SET', 'PAIR'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Cost Price ($)</label><input type="number" value={form.costPrice} onChange={e => set('costPrice', e.target.value)} className="input" min="0" step="0.01" required /></div>
            <div><label className="label">Sell Price ($)</label><input type="number" value={form.sellPrice} onChange={e => set('sellPrice', e.target.value)} className="input" min="0" step="0.01" required /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Reorder Point</label><input type="number" value={form.reorderPoint} onChange={e => set('reorderPoint', e.target.value)} className="input" min="0" required /></div>
            <div><label className="label">Initial Stock</label><input type="number" value={form.initialStock} onChange={e => set('initialStock', e.target.value)} className="input" min="0" /></div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">{mutation.isPending ? 'Adding...' : 'Add Product'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreatePOModal({ vendors, products, onClose, onSuccess }: any) {
  const [vendorId, setVendorId] = useState('');
  const [items, setItems] = useState([{ productId: '', quantity: 1, unitPrice: 0 }]);

  const addItem = () => setItems([...items, { productId: '', quantity: 1, unitPrice: 0 }]);
  const updateItem = (i: number, k: string, v: any) => setItems(items.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  const mutation = useMutation({
    mutationFn: () => api.post('/api/v1/supply-chain/purchase-orders', { vendorId, items }),
    onSuccess: () => { toast.success('Purchase order created!'); onSuccess(); },
    onError: (e: any) => toast.error(e?.message || 'Failed to create PO'),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <h2>Create Purchase Order</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="label">Vendor</label>
            <select value={vendorId} onChange={e => setVendorId(e.target.value)} className="input" required>
              <option value="">Select vendor</option>
              {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Line Items</label>
              <button type="button" onClick={addItem} className="text-xs text-blue-600 hover:underline font-medium">+ Add Item</button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <select value={item.productId} onChange={e => updateItem(i, 'productId', e.target.value)} className="input text-sm">
                      <option value="">Select product</option>
                      {products.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                    </select>
                  </div>
                  <div className="col-span-2"><input type="number" placeholder="Qty" value={item.quantity} onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 1)} className="input text-sm" min={1} /></div>
                  <div className="col-span-3"><input type="number" placeholder="Unit price" value={item.unitPrice} onChange={e => updateItem(i, 'unitPrice', parseFloat(e.target.value) || 0)} className="input text-sm" min={0} step="0.01" /></div>
                  <div className="col-span-1 text-xs text-slate-500 text-right">{fmt(item.quantity * item.unitPrice)}</div>
                  {items.length > 1 && <button type="button" onClick={() => removeItem(i)} className="col-span-1 text-red-400 hover:text-red-600 text-lg leading-none">×</button>}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end border-t pt-3">
            <p className="text-sm font-semibold text-slate-700">Total: <span className="text-lg text-blue-700">{fmt(total)}</span></p>
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !vendorId} className="btn-primary flex-1">
              {mutation.isPending ? 'Creating...' : 'Create Purchase Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdjustStockModal({ item, onClose, onSuccess }: any) {
  const [quantity, setQuantity] = useState(1);
  const [type, setType] = useState<'ADD' | 'REMOVE'>('ADD');
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.patch(`/api/v1/supply-chain/inventory/${item.productId}/adjust`, { quantity, type }),
    onSuccess: () => { toast.success(`Stock ${type === 'ADD' ? 'added' : 'removed'} successfully`); onSuccess(); },
    onError: (e: any) => toast.error(e?.message || 'Failed to adjust stock'),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b">
          <h2>Adjust Stock</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500">Product</p>
            <p className="font-semibold text-slate-800">{item.product.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">Current stock: <span className="font-bold text-slate-700">{item.quantityOnHand} {item.product.unit}</span></p>
          </div>
          <div>
            <label className="label">Adjustment Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setType('ADD')} className={`py-2 rounded-lg text-sm font-medium border transition-colors ${type === 'ADD' ? 'bg-green-50 border-green-500 text-green-700' : 'border-slate-200 text-slate-600'}`}>+ Add Stock</button>
              <button onClick={() => setType('REMOVE')} className={`py-2 rounded-lg text-sm font-medium border transition-colors ${type === 'REMOVE' ? 'bg-red-50 border-red-500 text-red-700' : 'border-slate-200 text-slate-600'}`}>− Remove Stock</button>
            </div>
          </div>
          <div>
            <label className="label">Quantity</label>
            <input type="number" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} className="input" min={1} max={type === 'REMOVE' ? item.quantityOnHand : 99999} />
          </div>
          <div className="p-3 bg-slate-50 rounded-lg text-sm">
            <span className="text-slate-500">New stock will be: </span>
            <span className="font-bold text-slate-800">
              {type === 'ADD' ? item.quantityOnHand + quantity : Math.max(0, item.quantityOnHand - quantity)} {item.product.unit}
            </span>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className={`flex-1 font-medium px-4 py-2 rounded-lg text-white text-sm transition-colors ${type === 'ADD' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
              {mutation.isPending ? 'Saving...' : type === 'ADD' ? 'Add Stock' : 'Remove Stock'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
