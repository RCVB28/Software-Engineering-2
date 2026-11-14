import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pagination } from '../../components/Pagination';
import { formatDate } from '../../components/format';
import { ApiError, api } from '../../services/api';
import { humanize, type FailureNotificationPage } from '../../types';

export function Notifications() {
  const [data, setData] = useState<FailureNotificationPage | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async (requestedPage: number) => {
    try {
      setError(null);
      setData(await api.notifications.list({ page: requestedPage, pageSize: 10 }));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load notifications.');
    }
  };

  useEffect(() => {
    void load(page);
  }, [page]);

  const handleAcknowledge = async (notificationId: string) => {
    setBusyId(notificationId);
    try {
      await api.notifications.acknowledge(notificationId);
      await load(page);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not acknowledge notification.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Failure Notifications</h1>
        <p className="text-sm text-slate-400">
          Alerts that completed with terminal delivery failures.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      {data && data.items.length === 0 ? (
        <section className="card">
          <p className="text-sm text-slate-400">No failure notifications.</p>
        </section>
      ) : null}

      {data && data.items.length > 0 && (
        <section className="card space-y-4">
          <p className="text-sm text-slate-400">
            {data.total} notification{data.total === 1 ? '' : 's'} / {data.unreadCount} unread
          </p>
          <ul className="space-y-3">
            {data.items.map((notification) => (
              <li
                key={notification.id}
                className="rounded-lg border border-slate-800 bg-slate-950/40 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {humanize(notification.alertCategory)}
                  </span>
                  <span className="text-xs text-slate-500">
                    {notification.failureCount} failed deliveries
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-100">
                  {notification.alertContent}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Completed {formatDate(notification.completedAt)}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Link
                    className="button-secondary py-1 text-xs"
                    to={`/admin/alerts/${notification.alertId}/deliveries`}
                  >
                    View delivery results
                  </Link>
                  {notification.readAt ? (
                    <span className="text-xs font-semibold uppercase text-emerald-400">
                      Acknowledged
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="button py-1 text-xs"
                      disabled={busyId === notification.id}
                      onClick={() => void handleAcknowledge(notification.id)}
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            totalPages={data.totalPages}
            onPageChange={setPage}
          />
        </section>
      )}
    </div>
  );
}
