import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { formatDate } from './format';
import { humanize, type FailureNotification } from '../types';

export function NotificationBell() {
  const [items, setItems] = useState<FailureNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const refresh = async () => {
    try {
      const page = await api.notifications.list({ pageSize: 5 });
      setItems(page.items);
      setUnreadCount(page.unreadCount);
    } catch {
      setItems([]);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const handleToggle = () => {
    setOpen((current) => !current);
    void refresh();
  };

  const handleAcknowledge = async (notificationId: string) => {
    await api.notifications.acknowledge(notificationId);
    await refresh();
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="button-secondary relative py-1"
        aria-label="Notifications"
        onClick={handleToggle}
      >
        Notifications
        {unreadCount > 0 && (
          <span className="ml-2 rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">
            {unreadCount} unread
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notification list"
          className="absolute right-0 z-20 mt-2 w-80 space-y-3 rounded-lg border border-slate-700 bg-slate-900 p-4 text-left shadow-xl"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">Failure notifications</h2>
            <Link className="text-xs underline text-slate-400" to="/admin/notifications">
              View all
            </Link>
          </div>

          {unreadCount === 0 && (
            <p className="text-sm text-slate-400">No unread notifications</p>
          )}

          {items.length === 0 && (
            <p className="text-sm text-slate-500">No failure notifications.</p>
          )}

          <ul className="max-h-80 space-y-3 overflow-auto">
            {items.map((notification) => (
              <li key={notification.id} className="rounded-md border border-slate-800 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase text-slate-400">
                    {humanize(notification.alertCategory)}
                  </span>
                  <span className="text-xs text-slate-500">
                    {notification.failureCount} failed deliveries
                  </span>
                </div>
                <Link
                  className="mt-1 block text-sm font-semibold text-slate-100 underline"
                  to={`/admin/alerts/${notification.alertId}/deliveries`}
                >
                  {notification.alertContent}
                </Link>
                <p className="mt-1 text-xs text-slate-500">
                  {formatDate(notification.completedAt)}
                </p>
                {!notification.readAt && (
                  <button
                    type="button"
                    className="button-secondary mt-2 py-1 text-xs"
                    onClick={() => void handleAcknowledge(notification.id)}
                  >
                    Acknowledge
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
