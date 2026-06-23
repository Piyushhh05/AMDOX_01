'use client';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../../lib/api';
import { DollarSign, Users, Package, TrendingUp, TrendingDown, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

function KpiCard({ title, value, subtitle, icon: Icon, trend, color }: any) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', color)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      {trend !== undefined && (
        <div className={cn('flex items-center gap-1 mt-3 text-xs font-medium', trend >= 0 ? 'text-green-600' : 'text-red-500')}>
          {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(trend)}% vs last month
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: any = {
    PAID: 'badge-green', SENT: 'badge-blue', DRAFT: 'badge-gray',
    OVERDUE: 'badge-red', PARTIALLY_PAID: 'badge-yellow',
    PENDING: 'badge-yellow', APPROVED: 'badge-green', REJECTED: 'badge-red',
  };
  return <span className={map[status] || 'badge-gray'}>{status}</span>;
}

export default function DashboardPage() {
  const { data: kpis, isLoading } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: () => api.get('/api/v1/dashboard/kpis'),
  });

  const { data: activity } = useQuery({
    queryKey: ['dashboard-activity'],
    queryFn: () => api.get('/api/v1/dashboard/recent-activity'),
  });

  const d = kpis as any;
  const act = activity as any;

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="card h-28 bg-slate-100" />)}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 card h-72 bg-slate-100" />
          <div className="card h-72 bg-slate-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">Welcome back — here's what's happening today.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title="Total Revenue" value={fmt(d?.finance?.revenue || 0)} subtitle="All time paid invoices" icon={DollarSign} color="bg-blue-600" trend={8.2} />
        <KpiCard title="Net Profit" value={fmt(d?.finance?.profit || 0)} subtitle={`${d?.finance?.profitMargin || 0}% margin`} icon={TrendingUp} color="bg-green-600" trend={3.1} />
        <KpiCard title="Active Employees" value={d?.hr?.totalEmployees || 0} subtitle={`${d?.hr?.onLeave || 0} on leave`} icon={Users} color="bg-purple-600" />
        <KpiCard title="Low Stock Items" value={d?.sc?.lowStockItems || 0} subtitle={`${d?.sc?.totalProducts || 0} total products`} icon={Package} color={d?.sc?.lowStockItems > 0 ? 'bg-orange-500' : 'bg-slate-500'} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Revenue Chart */}
        <div className="xl:col-span-2 card p-5">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Revenue vs Expenses (6 Months)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={d?.revenueChart || []}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => fmt(v)} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
              <Legend iconType="circle" iconSize={8} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" fill="url(#revGrad)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" fill="url(#expGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* HR Dept Breakdown */}
        <div className="card p-5">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Team by Department</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d?.hr?.deptBreakdown?.map((dept: any) => ({ name: dept.name, count: dept._count.employees })) || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
              <Bar dataKey="count" name="Employees" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Recent Invoices */}
        <div className="card">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Recent Invoices</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {act?.recentInvoices?.length === 0 && (
              <p className="text-sm text-slate-400 p-5 text-center">No invoices yet</p>
            )}
            {act?.recentInvoices?.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-slate-800">{inv.invoiceNumber}</p>
                  <p className="text-xs text-slate-400">{new Date(inv.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-800">{fmt(inv.totalAmount)}</p>
                  <StatusBadge status={inv.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity Log */}
        <div className="card">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Activity Feed</h3>
          </div>
          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {act?.recentLogs?.map((log: any) => (
              <div key={log.id} className="flex items-start gap-3 px-5 py-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="w-3 h-3 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-700">
                    <span className="font-medium">{log.user?.firstName}</span>{' '}
                    <span className="text-slate-500">{log.action.toLowerCase()}d</span>{' '}
                    <span className="font-medium">{log.resource}</span>
                  </p>
                  <p className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {!act?.recentLogs?.length && (
              <p className="text-sm text-slate-400 p-5 text-center">No activity yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Alert cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 border-l-4 border-yellow-400">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <p className="text-sm font-semibold text-slate-700">Pending Invoices</p>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{d?.finance?.pendingInvoices || 0}</p>
          <p className="text-xs text-slate-500">Awaiting payment</p>
        </div>
        <div className="card p-4 border-l-4 border-red-400">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <p className="text-sm font-semibold text-slate-700">Overdue Invoices</p>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{d?.finance?.overdueInvoices || 0}</p>
          <p className="text-xs text-slate-500">Need immediate attention</p>
        </div>
        <div className="card p-4 border-l-4 border-purple-400">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-500" />
            <p className="text-sm font-semibold text-slate-700">Pending Orders</p>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{d?.sc?.pendingOrders || 0}</p>
          <p className="text-xs text-slate-500">Purchase orders open</p>
        </div>
      </div>
    </div>
  );
}
