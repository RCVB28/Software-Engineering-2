import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pagination } from '../../components/Pagination';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDate } from '../../components/format';
import { ApiError, api } from '../../services/api';
import {
  ALERT_CATEGORIES,
  humanize,
  type AlertCategory,
  type AlertHistoryFilters,
  type AlertHistoryPage,
  type AlertStatus
} from '../../types';

const ALERT_STATUSES: AlertStatus[] = ['DRAFT', 'CONFIRMED', 'SENDING', 'COMPLETED'];

interface FormFilters {
  status: string;
  category: string;
  barangayId: string;
  from: string;
  to: string;
  q: string;
}

const emptyFilters: FormFilters = {
  status: '',
  category: '',
  barangayId: '',
  from: '',
  to: '',
  q: ''
};

function toApiFilters(filters: FormFilters, page: number): AlertHistoryFilters {
  return {
    page,
    pageSize: 10,
    ...(filters.status ? { status: filters.status as AlertStatus } : {}),
    ...(filters.category ? { category: filters.category as AlertCategory } : {}),
    ...(filters.barangayId ? { barangayId: filters.barangayId } : {}),
    ...(filters.from ? { from: `${filters.from}T00:00:00.000Z` } : {}),
    ...(filters.to ? { to: `${filters.to}T23:59:59.999Z` } : {}),
    ...(filters.q.trim() ? { q: filters.q.trim() } : {})
  };
}

export function AlertHistory() {
  const [filters, setFilters] = useState<FormFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<AlertHistoryFilters>({});
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AlertHistoryPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.alerts
      .history({ ...appliedFilters, page, pageSize: 10 })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((caught) => {
        if (active) {
          setError(caught instanceof ApiError ? caught.message : 'Could not load alert history.');
        }
      });
    return () => {
      active = false;
    };
  }, [appliedFilters, page]);

  const updateFilter = (field: keyof FormFilters, value: string) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const applyFilters = () => {
    setError(null);
    setAppliedFilters(toApiFilters(filters, 1));
    setPage(1);
  };

  const resetFilters = () => {
    setError(null);
    setFilters(emptyFilters);
    setAppliedFilters({});
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Alert History</h1>
        <p className="text-sm text-slate-400">
          Browse every alert, filter by status, category, barangay, date, or message.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      <section className="card">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <div>
            <label className="label" htmlFor="history-status">
              Status
            </label>
            <select
              id="history-status"
              className="input"
              value={filters.status}
              onChange={(event) => updateFilter('status', event.target.value)}
            >
              <option value="">All statuses</option>
              {ALERT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {humanize(status)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="history-category">
              Category
            </label>
            <select
              id="history-category"
              className="input"
              value={filters.category}
              onChange={(event) => updateFilter('category', event.target.value)}
            >
              <option value="">All categories</option>
              {ALERT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {humanize(category)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="history-barangay">
              Barangay
            </label>
            <select
              id="history-barangay"
              className="input"
              value={filters.barangayId}
              onChange={(event) => updateFilter('barangayId', event.target.value)}
            >
              <option value="">All barangays</option>
              {data?.availableBarangays.map((barangay) => (
                <option key={barangay.id} value={barangay.id}>
                  {barangay.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="history-from">
              From
            </label>
            <input
              id="history-from"
              type="date"
              className="input"
              value={filters.from}
              onChange={(event) => updateFilter('from', event.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="history-to">
              To
            </label>
            <input
              id="history-to"
              type="date"
              className="input"
              value={filters.to}
              onChange={(event) => updateFilter('to', event.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="history-search">
              Search message
            </label>
            <input
              id="history-search"
              className="input"
              value={filters.q}
              onChange={(event) => updateFilter('q', event.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className="button" onClick={applyFilters}>
            Apply filters
          </button>
          <button type="button" className="button-secondary" onClick={resetFilters}>
            Reset filters
          </button>
          {data && (
            <span className="self-center text-sm text-slate-400">
              {data.total} alert{data.total === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </section>

      {data && data.items.length === 0 && (
        <section className="card">
          <p className="text-sm text-slate-400">No alerts match these filters.</p>
        </section>
      )}

      {data && data.items.length > 0 && (
        <section className="card space-y-4">
          <ul className="space-y-3">
            {data.items.map((alert) => (
              <li
                key={alert.id}
                className="rounded-lg border border-slate-800 bg-slate-950/40 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {humanize(alert.category)}
                  </span>
                  <StatusBadge status={alert.status} />
                </div>
                <Link
                  className="mt-2 block text-sm font-semibold text-slate-100 underline"
                  to={
                    alert.status === 'DRAFT'
                      ? `/admin/alerts/${alert.id}`
                      : `/admin/alerts/${alert.id}/deliveries`
                  }
                >
                  {alert.content}
                </Link>
                <p className="mt-1 text-xs text-slate-500">
                  Created {formatDate(alert.createdAt)}
                  {alert.confirmedAt ? ` / Sent ${formatDate(alert.confirmedAt)}` : ''}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {alert.targets
                    .map((target) => {
                      const barangay = data.availableBarangays.find(
                        (item) => item.id === target.barangayId
                      );
                      return [
                        target.barangayId ? barangay?.name ?? target.barangayId : 'All barangays',
                        target.residentRole ? humanize(target.residentRole) : ''
                      ]
                        .filter(Boolean)
                        .join(' / ');
                    })
                    .join(', ')}
                </p>
                <p className="mt-2 text-xs font-semibold text-rose-300">
                  {alert.failureCount} failed
                </p>
              </li>
            ))}
          </ul>

          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            totalPages={data.totalPages}
            pageAdjusted={data.pageAdjusted}
            onPageChange={setPage}
          />
        </section>
      )}
    </div>
  );
}
