import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDate } from '../../components/format';
import { ApiError, api } from '../../services/api';
import { humanize, type Alert, type DeliveryRecord } from '../../types';

export function AlertDeliveries() {
  const { alertId = '' } = useParams();
  const [alert, setAlert] = useState<Alert | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.alerts.get(alertId), api.alerts.deliveries(alertId)])
      .then(([alertData, deliveryData]) => {
        setAlert(alertData);
        setDeliveries(deliveryData);
      })
      .catch((caught) => {
        setError(caught instanceof ApiError ? caught.message : 'Could not load deliveries.');
      });
  }, [alertId]);

  const counts = deliveries.reduce<Record<string, number>>((accumulator, delivery) => {
    accumulator[delivery.status] = (accumulator[delivery.status] ?? 0) + 1;
    return accumulator;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Delivery Results</h1>
          <p className="text-sm text-slate-400">
            Per-recipient outcomes for alert <span className="font-mono text-xs">{alertId}</span>
          </p>
        </div>
        <Link className="button-secondary" to="/admin/compose">
          Back to composer
        </Link>
      </div>

      {error && (
        <p className="rounded-md border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      {alert && (
        <div className="card space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={alert.status} />
            <span className="text-sm font-semibold text-slate-200">{humanize(alert.category)}</span>
            <span className="text-xs text-slate-500">Created {formatDate(alert.createdAt)}</span>
            {alert.confirmedAt && (
              <span className="text-xs text-slate-500">Confirmed {formatDate(alert.confirmedAt)}</span>
            )}
          </div>
          <p className="text-sm text-slate-300">{alert.content}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {['SUCCESS', 'FAILURE', 'DELAYED', 'SUBMITTED'].map((status) => (
          <div key={status} className="card py-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">{humanize(status)}</p>
            <p className="text-2xl font-bold text-white">{counts[status] ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Recipient</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Attempts</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2">Last error</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-slate-500" colSpan={6}>
                  No delivery records yet.
                </td>
              </tr>
            )}
            {deliveries.map((delivery) => (
              <tr key={delivery.id} className="border-b border-slate-800/60">
                <td className="px-3 py-2 font-mono text-xs text-slate-400">{delivery.residentId}</td>
                <td className="px-3 py-2">{delivery.phoneNumber}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={delivery.status} />
                </td>
                <td className="px-3 py-2">{delivery.attempts}</td>
                <td className="px-3 py-2 text-xs text-slate-400">{formatDate(delivery.updatedAt)}</td>
                <td className="px-3 py-2 text-xs text-rose-300">{delivery.lastError ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
