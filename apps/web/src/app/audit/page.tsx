'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { fmtDateTime } from '../../lib/utils';
import { Shield, Search, Filter } from 'lucide-react';

const actionColor: Record<string, string> = {
  CREATE: 'badge-green',
  UPDATE: 'badge-blue',
  DELETE: 'badge-red',
  LOGIN: 'badge-gray',
  LOGOUT: 'badge-gray',
  APPROVE: 'badge-green',
  REJECT: 'badge-red',
  EXPORT: 'badge-yellow',
};

export default function AuditPage() {
  const [resource, setResource] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', resource, action, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (resource) params.set('resource', resource);
      if (action) params.set('action', action);
      return api.get(`/api/v1/audit/logs?${params}`);
    },
  });

  const result = data as any;
  const logs = result?.data || [];
  const total = result?.total || 0;
  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1>Audit Logs</h1>
          <p className="text-slate-500 text-sm mt-0.5">Immutable tamper-evident record of all system actions</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <Shield className="w-3.5 h-3.5 text-green-600" />
          <span className="text-green-700 font-medium">SOC 2 Compliant</span>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">Filters:</span>
        </div>
        <select value={resource} onChange={e => { setResource(e.target.value); setPage(1); }} className="input w-44 text-sm">
          <option value="">All Resources</option>
          {['Invoice', 'Employee', 'PayrollRun', 'PurchaseOrder', 'Vendor', 'Product', 'Account', 'JournalEntry', 'LeaveRequest', 'User'].map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select value={action} onChange={e => { setAction(e.target.value); setPage(1); }} className="input w-36 text-sm">
          <option value="">All Actions</option>
          {['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE', 'REJECT', 'EXPORT'].map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <p className="text-xs text-slate-400 self-center ml-auto">{total.toLocaleString()} total records</p>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                {['Timestamp', 'User', 'Action', 'Resource', 'Resource ID', 'IP Address'].map(h => (
                  <th key={h} className="px-5 py-3 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && [...Array(10)].map((_, i) => (
                <tr key={i} className="border-b border-slate-100 animate-pulse">
                  {[...Array(6)].map((_, j) => (
                    <td key={j} className="px-5 py-3">
                      <div className="h-3 bg-slate-100 rounded w-24" />
                    </td>
                  ))}
                </tr>
              ))}

              {!isLoading && logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No audit records found for the selected filters.
                  </td>
                </tr>
              )}

              {logs.map((log: any) => (
                <tr key={log.id} className="table-row">
                  <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap font-mono">
                    {fmtDateTime(log.createdAt)}
                  </td>
                  <td className="px-5 py-3">
                    {log.user ? (
                      <div>
                        <p className="font-medium text-slate-800 text-xs">
                          {log.user.firstName} {log.user.lastName}
                        </p>
                        <p className="text-xs text-slate-400">{log.user.email}</p>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">System</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={actionColor[log.action] || 'badge-gray'}>{log.action}</span>
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-700">{log.resource}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-400 max-w-[120px] truncate">
                    {log.resourceId || '—'}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-400">
                    {log.ipAddress || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info banner */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
        <Shield className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-slate-500">
          All audit records are immutable and append-only. Records cannot be modified or deleted.
          This log is used for SOC 2 Type II compliance, GDPR data subject requests, and internal security reviews.
          Hash-chaining ensures tamper detection.
        </p>
      </div>
    </div>
  );
}
