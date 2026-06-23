'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { fmt, fmtDate } from '../../lib/utils';
import toast from 'react-hot-toast';
import { Plus, FileText, DollarSign, TrendingUp, Clock, Filter } from 'lucide-react';

const statusColor: any = { PAID: 'badge-green', SENT: 'badge-blue', DRAFT: 'badge-gray', OVERDUE: 'badge-red', PARTIALLY_PAID: 'badge-yellow', CANCELLED: 'badge-gray' };

export default function FinancePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'invoices' | 'accounts' | 'journal' | 'aging'>('invoices');
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: summary } = useQuery({ queryKey: ['finance-summary'], queryFn: () => api.get('/api/v1/finance/summary') });
  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['invoices', typeFilter],
    queryFn: () => api.get(`/api/v1/finance/invoices${typeFilter ? `?type=${typeFilter}` : ''}`),
  });
  const { data: accounts } = useQuery({ queryKey: ['accounts'], queryFn: () => api.get('/api/v1/finance/accounts') });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: any) => api.patch(`/api/v1/finance/invoices/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Status updated'); },
    onError: () => toast.error('Failed to update status'),
  });

  const { data: agingData } = useQuery({
    queryKey: ['ar-aging'],
    queryFn: () => api.get('/api/v1/finance/aging/ar'),
    enabled: tab === 'aging',
  });

  const s = summary as any;
  const invoices = (invoicesData as any)?.data || [];
  const accs = accounts as any[] || [];
  const aging = agingData as any;

  const tabs = [
    { id: 'invoices', label: 'Invoices & Bills' },
    { id: 'accounts', label: 'Chart of Accounts' },
    { id: 'aging', label: 'Aging Report' },
    { id: 'journal', label: 'Journal Entries' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1>Finance</h1>
          <p className="text-slate-500 text-sm mt-0.5">General Ledger, Invoices & Payments</p>
        </div>
        <div className="flex gap-2">
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL}/api/v1/export/invoices`}
            className="btn-secondary flex items-center gap-2 text-sm"
            download
          >
            ↓ Export CSV
          </a>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Invoice
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: fmt(s?.revenue), icon: TrendingUp, color: 'bg-green-500' },
          { label: 'Total Expenses', value: fmt(s?.expenses), icon: DollarSign, color: 'bg-red-500' },
          { label: 'Net Profit', value: fmt(s?.profit), icon: DollarSign, color: 'bg-blue-600' },
          { label: 'Pending Invoices', value: s?.pendingInvoices || 0, icon: Clock, color: 'bg-yellow-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
              <Icon className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="font-bold text-slate-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="flex border-b border-slate-200">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Invoices Tab */}
        {tab === 'invoices' && (
          <div>
            <div className="p-4 flex gap-2 border-b border-slate-100">
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input w-40">
                <option value="">All Types</option>
                <option value="RECEIVABLE">Invoices (AR)</option>
                <option value="PAYABLE">Bills (AP)</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                    <th className="px-5 py-3 text-left font-semibold">Number</th>
                    <th className="px-5 py-3 text-left font-semibold">Type</th>
                    <th className="px-5 py-3 text-left font-semibold">Customer / Vendor</th>
                    <th className="px-5 py-3 text-left font-semibold">Amount</th>
                    <th className="px-5 py-3 text-left font-semibold">Due Date</th>
                    <th className="px-5 py-3 text-left font-semibold">Status</th>
                    <th className="px-5 py-3 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-slate-100 animate-pulse">
                      {[...Array(7)].map((_, j) => <td key={j} className="px-5 py-3"><div className="h-3 bg-slate-100 rounded w-20" /></td>)}
                    </tr>
                  ))}
                  {!isLoading && invoices.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-12 text-slate-400">No invoices yet. Create your first one.</td></tr>
                  )}
                  {invoices.map((inv: any) => (
                    <tr key={inv.id} className="table-row">
                      <td className="px-5 py-3 font-medium text-blue-600">{inv.invoiceNumber}</td>
                      <td className="px-5 py-3">
                        <span className={inv.type === 'RECEIVABLE' ? 'badge-green' : 'badge-blue'}>{inv.type === 'RECEIVABLE' ? 'Invoice' : 'Bill'}</span>
                      </td>
                      <td className="px-5 py-3 text-slate-700">{inv.customerName || inv.vendor?.name || '—'}</td>
                      <td className="px-5 py-3 font-semibold">{fmt(inv.totalAmount)}</td>
                      <td className="px-5 py-3 text-slate-500">{new Date(inv.dueDate).toLocaleDateString()}</td>
                      <td className="px-5 py-3"><span className={statusColor[inv.status] || 'badge-gray'}>{inv.status}</span></td>
                      <td className="px-5 py-3">
                        {inv.status === 'DRAFT' && (
                          <button onClick={() => updateStatus.mutate({ id: inv.id, status: 'SENT' })} className="text-xs text-blue-600 hover:underline mr-3">Mark Sent</button>
                        )}
                        {inv.status === 'SENT' && (
                          <button onClick={() => updateStatus.mutate({ id: inv.id, status: 'PAID' })} className="text-xs text-green-600 hover:underline">Mark Paid</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Accounts Tab */}
        {tab === 'accounts' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                  <th className="px-5 py-3 text-left font-semibold">Code</th>
                  <th className="px-5 py-3 text-left font-semibold">Account Name</th>
                  <th className="px-5 py-3 text-left font-semibold">Type</th>
                  <th className="px-5 py-3 text-left font-semibold">Subtype</th>
                  <th className="px-5 py-3 text-right font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody>
                {accs.map((acc: any) => (
                  <tr key={acc.id} className="table-row">
                    <td className="px-5 py-3 font-mono text-slate-600">{acc.code}</td>
                    <td className="px-5 py-3 font-medium">{acc.name}</td>
                    <td className="px-5 py-3"><span className="badge-blue">{acc.type}</span></td>
                    <td className="px-5 py-3 text-slate-500">{acc.subtype || '—'}</td>
                    <td className="px-5 py-3 text-right font-semibold">{fmt(acc.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'journal' && (
          <div className="p-8 text-center text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Journal entries are created automatically when invoices are processed.</p>
          </div>
        )}

        {/* Aging Report */}
        {tab === 'aging' && (
          <div className="p-5 space-y-5">
            {/* Bucket Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: 'Current', key: 'current', color: 'bg-green-500' },
                { label: '1–30 Days', key: 'days1_30', color: 'bg-yellow-400' },
                { label: '31–60 Days', key: 'days31_60', color: 'bg-orange-500' },
                { label: '61–90 Days', key: 'days61_90', color: 'bg-red-500' },
                { label: 'Over 90 Days', key: 'over90', color: 'bg-red-800' },
              ].map(({ label, key, color }) => (
                <div key={key} className="card p-3 text-center">
                  <div className={`w-2 h-2 rounded-full ${color} mx-auto mb-2`} />
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-base font-bold text-slate-900 mt-1">
                    {fmt(aging?.summary?.[key] || 0)}
                  </p>
                </div>
              ))}
            </div>
            {/* Detail table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                    {['Invoice #', 'Customer', 'Due Date', 'Total', 'Paid', 'Outstanding', 'Days Overdue'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(aging?.details || []).length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-slate-400">No outstanding receivables. Great job!</td></tr>
                  )}
                  {(aging?.details || []).map((row: any) => (
                    <tr key={row.invoiceNumber} className="table-row">
                      <td className="px-4 py-3 font-mono text-blue-600 font-semibold">{row.invoiceNumber}</td>
                      <td className="px-4 py-3 font-medium">{row.customer}</td>
                      <td className="px-4 py-3 text-slate-500">{new Date(row.dueDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3">{fmt(row.total)}</td>
                      <td className="px-4 py-3 text-green-600">{fmt(row.paid)}</td>
                      <td className="px-4 py-3 font-bold text-red-600">{fmt(row.outstanding)}</td>
                      <td className="px-4 py-3">
                        <span className={row.daysOverdue > 90 ? 'badge-red' : row.daysOverdue > 30 ? 'badge-yellow' : 'badge-green'}>
                          {row.daysOverdue === 0 ? 'Current' : `${row.daysOverdue}d`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create Invoice Modal */}
      {showCreateModal && <CreateInvoiceModal onClose={() => setShowCreateModal(false)} onSuccess={() => { setShowCreateModal(false); qc.invalidateQueries({ queryKey: ['invoices'] }); }} />}
    </div>
  );
}

function CreateInvoiceModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ type: 'RECEIVABLE', customerName: '', issueDate: new Date().toISOString().split('T')[0], dueDate: '', notes: '', description: '', quantity: 1, unitPrice: 0 });

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/api/v1/finance/invoices', data),
    onSuccess: () => { toast.success('Invoice created!'); onSuccess(); },
    onError: (e: any) => toast.error(e?.message || 'Failed to create invoice'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      type: form.type,
      customerName: form.customerName,
      issueDate: form.issueDate,
      dueDate: form.dueDate,
      notes: form.notes,
      lineItems: [{ description: form.description, quantity: Number(form.quantity), unitPrice: Number(form.unitPrice) }],
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b">
          <h2>Create Invoice</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Type</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="input">
                <option value="RECEIVABLE">Invoice (AR)</option>
                <option value="PAYABLE">Bill (AP)</option>
              </select>
            </div>
            <div>
              <label className="label">Customer / Vendor</label>
              <input value={form.customerName} onChange={e => setForm({...form, customerName: e.target.value})} className="input" placeholder="Customer name" required />
            </div>
          </div>
          <div>
            <label className="label">Line Item Description</label>
            <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="input" placeholder="Service or product description" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Quantity</label>
              <input type="number" value={form.quantity} onChange={e => setForm({...form, quantity: Number(e.target.value)})} className="input" min={1} required />
            </div>
            <div>
              <label className="label">Unit Price ($)</label>
              <input type="number" value={form.unitPrice} onChange={e => setForm({...form, unitPrice: Number(e.target.value)})} className="input" min={0} step="0.01" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Issue Date</label>
              <input type="date" value={form.issueDate} onChange={e => setForm({...form, issueDate: e.target.value})} className="input" required />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input type="date" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} className="input" required />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">
              {mutation.isPending ? 'Creating...' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
