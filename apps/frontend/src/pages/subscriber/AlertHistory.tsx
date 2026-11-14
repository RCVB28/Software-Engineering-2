import { useEffect, useState } from 'react';
import { Pagination } from '../../components/Pagination';
import { formatDate } from '../../components/format';
import { ApiError, api } from '../../services/api';
import {
  humanize,
  type ResidentAlertHistoryPage,
  type ResidentDeliveryOutcome
} from '../../types';

const outcomeLabels: Record<ResidentDeliveryOutcome, string> = {
  SUCCESS: 'Delivered',
  FAILURE: 'Failed',
  PARTIAL: 'Partially delivered',
  PENDING: 'Pending'
};

const outcomeStyles: Record<ResidentDeliveryOutcome, string> = {
  SUCCESS: 'border-emerald-700 bg-emerald-950/60 text-emerald-200',
  FAILURE: 'border-rose-800 bg-rose-950/60 text-rose-200',
  PARTIAL: 'border-amber-700 bg-amber-950/60 text-amber-200',
  PENDING: 'border-sky-800 bg-sky-950/60 text-sky-200'
};

export function ResidentAlertHistory() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ResidentAlertHistoryPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.residents
      .alertHistory(page)
      .then((result) => {
        if (active) {
          setData(result);
          setError(null);
        }
      })
      .catch((caught) => {
        if (active) {
          setError(caught instanceof ApiError ? caught.message : 'Could not load alert history.');
        }
      });
    return () => {
      active = false;
    };
  }, [page]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Alert History</h1>
        <p className="text-sm text-slate-400">
          Alerts delivered to your registered phone numbers, newest first.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      {data && data.items.length === 0 && (
        <div className="card text-sm text-slate-500">No alert history yet.</div>
      )}

      <div className="space-y-3">
        {data?.items.map((item) => (
          <article key={item.alertId} className="card">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${outcomeStyles[item.outcome]}`}
              >
                {outcomeLabels[item.outcome]}
              </span>
              <span className="text-sm font-semibold text-slate-200">
                {humanize(item.category)}
              </span>
              <span className="text-xs text-slate-500">Sent {formatDate(item.sentAt)}</span>
            </div>
            <p className="text-slate-200">{item.content}</p>
          </article>
        ))}
      </div>

      {data && data.total > 0 && (
        <Pagination
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          totalPages={data.totalPages}
          pageAdjusted={data.pageAdjusted}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
