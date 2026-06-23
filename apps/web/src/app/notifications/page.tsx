'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { fmtDateTime } from '../../lib/utils';
import toast from 'react-hot-toast';
import { Bell, CheckCheck, AlertTriangle, Info, Package, DollarSign } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';

const iconMap: Record<string, any> = {
  '⚠️': AlertTriangle,
  '✅': CheckCheck,
};

function NotifIcon({ title }: { title: string }) {
  if (title.includes('Stock') || title.includes('stock')) return <Package className="w-4 h-4 text-orange-500" />;
  if (title.includes('Invoice') || title.includes('Payment')) return <DollarSign className="w-4 h-4 text-blue-500" />;
  if (title.includes('Payroll')) return <CheckCheck className="w-4 h-4 text-green-500" />;
  if (title.includes('Leave')) return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
  return <Info className="w-4 h-4 text-slate-400" />;
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/api/v1/notifications'),
    refetchInterval: 15_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/notifications/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch('/api/v1/notifications/read-all', {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); toast.success('All marked as read'); },
  });

  const notifs = (notifications as any[]) || [];
  const unread = notifs.filter(n => !n.readAt);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1>Notifications</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {unread.length > 0 ? `${unread.length} unread notification${unread.length > 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        {unread.length > 0 && (
          <button onClick={() => markAllRead.mutate()} className="btn-secondary flex items-center gap-2 text-sm">
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      {/* Notification list */}
      <div className="card divide-y divide-slate-100">
        {isLoading && (
          [...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4 p-5 animate-pulse">
              <div className="w-9 h-9 rounded-full bg-slate-100 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-slate-100 rounded w-48" />
                <div className="h-3 bg-slate-100 rounded w-72" />
                <div className="h-2 bg-slate-100 rounded w-24" />
              </div>
            </div>
          ))
        )}

        {!isLoading && notifs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Bell className="w-10 h-10 mb-3 opacity-30" />
            <p className="font-medium">No notifications yet</p>
            <p className="text-sm mt-1">You'll see alerts for invoices, payroll, stock levels and more here.</p>
          </div>
        )}

        {notifs.map((notif: any) => (
          <div
            key={notif.id}
            className={`flex gap-4 p-5 transition-colors ${!notif.readAt ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50'}`}
          >
            {/* Icon */}
            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${!notif.readAt ? 'bg-blue-100' : 'bg-slate-100'}`}>
              <NotifIcon title={notif.title} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className={`text-sm ${!notif.readAt ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                  {notif.title}
                </p>
                {!notif.readAt && (
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                )}
              </div>
              <p className="text-sm text-slate-500 mt-0.5">{notif.message}</p>
              <div className="flex items-center gap-4 mt-2">
                <p className="text-xs text-slate-400">{fmtDateTime(notif.createdAt)}</p>
                {!notif.readAt && (
                  <button
                    onClick={() => markRead.mutate(notif.id)}
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    Mark as read
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
