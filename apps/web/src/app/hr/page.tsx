'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { fmt, fmtDate } from '../../lib/utils';
import toast from 'react-hot-toast';
import { Plus, Users, UserCheck, UserX, DollarSign, Play, ChevronDown } from 'lucide-react';

const statusColor: Record<string, string> = {
  ACTIVE: 'badge-green', ON_LEAVE: 'badge-yellow', TERMINATED: 'badge-red',
  RESIGNED: 'badge-gray', PROBATION: 'badge-blue',
};
const leaveColor: Record<string, string> = {
  PENDING: 'badge-yellow', APPROVED: 'badge-green', REJECTED: 'badge-red', CANCELLED: 'badge-gray',
};

export default function HrPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'employees' | 'leave' | 'payroll'>('employees');
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showRunPayroll, setShowRunPayroll] = useState(false);

  const { data: summary } = useQuery({ queryKey: ['hr-summary'], queryFn: () => api.get('/api/v1/hr/summary') });
  const { data: empData, isLoading: empLoading } = useQuery({ queryKey: ['employees'], queryFn: () => api.get('/api/v1/hr/employees?limit=50') });
  const { data: leaveData } = useQuery({ queryKey: ['leaves'], queryFn: () => api.get('/api/v1/hr/leave-requests') });
  const { data: payrollData } = useQuery({ queryKey: ['payrolls'], queryFn: () => api.get('/api/v1/hr/payroll') });
  const { data: depts } = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/api/v1/hr/departments') });

  const updateLeave = useMutation({
    mutationFn: ({ id, status }: any) => api.patch(`/api/v1/hr/leave-requests/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leaves'] }); toast.success('Leave request updated'); },
  });

  const s = summary as any;
  const employees = (empData as any)?.data || [];
  const leaves = (leaveData as any[]) || [];
  const payrolls = (payrollData as any[]) || [];
  const departments = (depts as any[]) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1>HR & Payroll</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage employees, leave and salary processing</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowRunPayroll(true)} className="btn-secondary flex items-center gap-2">
            <Play className="w-4 h-4 text-green-600" /> Run Payroll
          </button>
          <button onClick={() => setShowAddEmployee(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Employee
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Employees', value: s?.totalEmployees || 0, icon: Users, color: 'bg-blue-600' },
          { label: 'On Leave', value: s?.onLeave || 0, icon: UserX, color: 'bg-yellow-500' },
          { label: 'New This Month', value: s?.newThisMonth || 0, icon: UserCheck, color: 'bg-green-500' },
          { label: 'Departments', value: departments.length, icon: DollarSign, color: 'bg-purple-600' },
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
          {(['employees', 'leave', 'payroll'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px capitalize ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t === 'leave' ? 'Leave Requests' : t === 'payroll' ? 'Payroll Runs' : 'Employees'}
            </button>
          ))}
        </div>

        {/* Employees */}
        {tab === 'employees' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  {['Emp #', 'Name', 'Department', 'Designation', 'Base Salary', 'Status', 'Joined'].map(h => (
                    <th key={h} className="px-5 py-3 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {empLoading && [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-100 animate-pulse">
                    {[...Array(7)].map((_, j) => <td key={j} className="px-5 py-3"><div className="h-3 bg-slate-100 rounded w-20" /></td>)}
                  </tr>
                ))}
                {!empLoading && employees.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10 text-slate-400">No employees. Add your first one.</td></tr>
                )}
                {employees.map((emp: any) => (
                  <tr key={emp.id} className="table-row">
                    <td className="px-5 py-3 font-mono text-slate-500 text-xs">{emp.employeeNumber}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                          {emp.firstName[0]}{emp.lastName[0]}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{emp.firstName} {emp.lastName}</p>
                          <p className="text-xs text-slate-400">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{emp.department?.name || '—'}</td>
                    <td className="px-5 py-3 text-slate-600">{emp.designation || '—'}</td>
                    <td className="px-5 py-3 font-semibold">{fmt(emp.baseSalary)}</td>
                    <td className="px-5 py-3"><span className={statusColor[emp.employmentStatus] || 'badge-gray'}>{emp.employmentStatus}</span></td>
                    <td className="px-5 py-3 text-slate-500">{fmtDate(emp.joinDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Leave Requests */}
        {tab === 'leave' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  {['Employee', 'Type', 'From', 'To', 'Days', 'Reason', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaves.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-slate-400">No leave requests found.</td></tr>}
                {leaves.map((req: any) => (
                  <tr key={req.id} className="table-row">
                    <td className="px-5 py-3 font-medium">{req.employee?.firstName} {req.employee?.lastName}</td>
                    <td className="px-5 py-3"><span className="badge-blue">{req.type}</span></td>
                    <td className="px-5 py-3 text-slate-500">{fmtDate(req.startDate)}</td>
                    <td className="px-5 py-3 text-slate-500">{fmtDate(req.endDate)}</td>
                    <td className="px-5 py-3 font-semibold">{req.days}d</td>
                    <td className="px-5 py-3 text-slate-500 max-w-[150px] truncate">{req.reason || '—'}</td>
                    <td className="px-5 py-3"><span className={leaveColor[req.status] || 'badge-gray'}>{req.status}</span></td>
                    <td className="px-5 py-3">
                      {req.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <button onClick={() => updateLeave.mutate({ id: req.id, status: 'APPROVED' })} className="text-xs text-green-600 font-medium hover:underline">Approve</button>
                          <button onClick={() => updateLeave.mutate({ id: req.id, status: 'REJECTED' })} className="text-xs text-red-500 font-medium hover:underline">Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Payroll Runs */}
        {tab === 'payroll' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  {['Period', 'Employees', 'Total Gross', 'Total Tax', 'Total Net', 'Status', 'Processed', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payrolls.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-slate-400">No payroll runs yet. Click "Run Payroll" to start.</td></tr>}
                {payrolls.map((run: any) => (
                  <tr key={run.id} className="table-row">
                    <td className="px-5 py-3 font-mono font-semibold">{run.period}</td>
                    <td className="px-5 py-3">{run.employeeCount}</td>
                    <td className="px-5 py-3 font-semibold">{fmt(run.totalGross)}</td>
                    <td className="px-5 py-3 text-red-500">{fmt(run.totalTax)}</td>
                    <td className="px-5 py-3 font-bold text-green-700">{fmt(run.totalNet)}</td>
                    <td className="px-5 py-3"><span className={run.status === 'COMPLETED' ? 'badge-green' : 'badge-yellow'}>{run.status}</span></td>
                    <td className="px-5 py-3 text-slate-500">{run.processedAt ? fmtDate(run.processedAt) : '—'}</td>
                    <td className="px-5 py-3">
                      {run.status === 'COMPLETED' && (
                        <button
                          onClick={() => {
                            const token = document.cookie.match(/accessToken=([^;]+)/)?.[1] || '';
                            // Opens payslip for the logged-in employee — HR managers see all lines via payroll run detail
                            toast.success('Payslip feature: HR managers can view individual payslips from the payroll run detail page.');
                          }}
                          className="text-xs text-blue-600 hover:underline font-medium"
                        >
                          Payslip ↗
                        </button>
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
      {showAddEmployee && (
        <AddEmployeeModal
          departments={departments}
          onClose={() => setShowAddEmployee(false)}
          onSuccess={() => { setShowAddEmployee(false); qc.invalidateQueries({ queryKey: ['employees'] }); qc.invalidateQueries({ queryKey: ['hr-summary'] }); }}
        />
      )}
      {showRunPayroll && (
        <RunPayrollModal
          onClose={() => setShowRunPayroll(false)}
          onSuccess={() => { setShowRunPayroll(false); qc.invalidateQueries({ queryKey: ['payrolls'] }); }}
        />
      )}
    </div>
  );
}

function AddEmployeeModal({ departments, onClose, onSuccess }: any) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', designation: '', departmentId: '', baseSalary: '', joinDate: new Date().toISOString().split('T')[0] });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/api/v1/hr/employees', data),
    onSuccess: () => { toast.success('Employee added!'); onSuccess(); },
    onError: (e: any) => toast.error(e?.message || 'Failed to add employee'),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b">
          <h2>Add Employee</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
        </div>
        <form onSubmit={e => { e.preventDefault(); mutation.mutate({ ...form, baseSalary: parseFloat(form.baseSalary) }); }} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">First Name</label><input value={form.firstName} onChange={e => set('firstName', e.target.value)} className="input" required /></div>
            <div><label className="label">Last Name</label><input value={form.lastName} onChange={e => set('lastName', e.target.value)} className="input" required /></div>
          </div>
          <div><label className="label">Email</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="input" required /></div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Department</label>
              <select value={form.departmentId} onChange={e => set('departmentId', e.target.value)} className="input">
                <option value="">Select department</option>
                {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div><label className="label">Designation</label><input value={form.designation} onChange={e => set('designation', e.target.value)} className="input" placeholder="e.g. Engineer" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Base Salary (USD)</label><input type="number" value={form.baseSalary} onChange={e => set('baseSalary', e.target.value)} className="input" min="0" step="0.01" required /></div>
            <div><label className="label">Join Date</label><input type="date" value={form.joinDate} onChange={e => set('joinDate', e.target.value)} className="input" required /></div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">{mutation.isPending ? 'Adding...' : 'Add Employee'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RunPayrollModal({ onClose, onSuccess }: any) {
  const now = new Date();
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

  const mutation = useMutation({
    mutationFn: () => api.post('/api/v1/hr/payroll/run', { period }),
    onSuccess: () => { toast.success(`Payroll for ${period} processed!`); onSuccess(); },
    onError: (e: any) => toast.error(e?.message || 'Payroll run failed'),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b">
          <h2>Run Payroll</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-500">This will calculate and process payroll for all active employees for the selected period.</p>
          <div>
            <label className="label">Payroll Period</label>
            <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="input" />
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            ⚠️ This action cannot be undone. Ensure all attendance and overtime data is finalized.
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="btn-primary flex-1 bg-green-600 hover:bg-green-700">
              {mutation.isPending ? 'Processing...' : 'Run Payroll'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
