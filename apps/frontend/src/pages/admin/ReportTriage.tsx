import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDate } from '../../components/format';
import { useAuth } from '../../hooks/useAuth';
import { ApiError, api } from '../../services/api';
import {
  REPORT_STATUSES,
  humanize,
  type EmergencyReport,
  type ReportStatus
} from '../../types';

export function ReportTriage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<ReportStatus | ''>('');
  const [reports, setReports] = useState<EmergencyReport[]>([]);
  const [selected, setSelected] = useState<EmergencyReport | null>(null);
  const [escalation, setEscalation] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setReports(await api.reports.adminList(filter || undefined));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load reports.');
    }
  };

  useEffect(() => {
    load();
  }, [filter]);

  const applyStatus = async (status: ReportStatus) => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.reports.updateStatus(selected.id, status);
      setSelected(updated);
      setNotice(`Report marked ${humanize(status)}.`);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not update report.');
    } finally {
      setBusy(false);
    }
  };

  const handleEscalate = async () => {
    if (!selected) return;
    if (!escalation.trim()) {
      setError('Enter alert content before escalating.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const alert = await api.reports.escalate(selected.id, escalation.trim());
      setNotice(`Draft alert ${alert.id} created. Confirm it in the composer workflow before broadcasting.`);
      setEscalation('');
      await load();
      setSelected({ ...selected, escalatedAlertId: alert.id });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not escalate report.');
    } finally {
      setBusy(false);
    }
  };

  const availableActions = (status: ReportStatus): ReportStatus[] => {
    if (status === 'NEW') return ['ACKNOWLEDGED', 'DISMISSED'];
    if (status === 'ACKNOWLEDGED') return ['RESOLVED', 'DISMISSED'];
    return [];
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Report Triage</h1>
          <p className="text-sm text-slate-400">
            Reports are scoped to your jurisdiction. Low-level admins see only their barangay.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`button-secondary py-1 text-xs ${filter === '' ? 'border-alert-500' : ''}`}
            onClick={() => setFilter('')}
          >
            All
          </button>
          {REPORT_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              className={`button-secondary py-1 text-xs ${filter === status ? 'border-alert-500' : ''}`}
              onClick={() => setFilter(status)}
            >
              {humanize(status)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-md border border-emerald-800 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200">
          {notice}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2">Category</th>
                <th className="px-2 py-2">Severity</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 && (
                <tr>
                  <td className="px-2 py-4 text-slate-500" colSpan={4}>
                    No reports in this jurisdiction.
                  </td>
                </tr>
              )}
              {reports.map((report) => (
                <tr
                  key={report.id}
                  className={`cursor-pointer border-b border-slate-800/60 transition hover:bg-slate-800/40 ${
                    selected?.id === report.id ? 'bg-slate-800/60' : ''
                  }`}
                  onClick={() => {
                    setSelected(report);
                    setNotice(null);
                    setError(null);
                  }}
                >
                  <td className="px-2 py-2 font-semibold text-slate-200">{humanize(report.category)}</td>
                  <td className="px-2 py-2">
                    <StatusBadge status={report.severity} />
                  </td>
                  <td className="px-2 py-2">
                    <StatusBadge status={report.status} />
                  </td>
                  <td className="px-2 py-2 text-xs text-slate-400">{formatDate(report.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card space-y-4">
          {!selected && <p className="text-sm text-slate-500">Select a report to review it.</p>}
          {selected && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={selected.status} />
                <StatusBadge status={selected.severity} />
                <span className="text-sm font-semibold text-slate-200">
                  {humanize(selected.category)}
                </span>
              </div>
              <p className="text-sm text-slate-300">{selected.description}</p>
              <dl className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                <div>
                  <dt className="uppercase tracking-wide text-slate-500">Location</dt>
                  <dd>
                    {selected.addressText ??
                      `${selected.latitude ?? '—'}, ${selected.longitude ?? '—'}`}
                  </dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide text-slate-500">Barangay</dt>
                  <dd className="font-mono">{selected.barangayId}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide text-slate-500">Submitted</dt>
                  <dd>{formatDate(selected.createdAt)}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide text-slate-500">Escalated alert</dt>
                  <dd>
                    {selected.escalatedAlertId ? (
                      <Link
                        className="text-alert-500 underline"
                        to={`/admin/alerts/${selected.escalatedAlertId}/deliveries`}
                      >
                        {selected.escalatedAlertId}
                      </Link>
                    ) : (
                      'None'
                    )}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-2">
                {availableActions(selected.status).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={status === 'DISMISSED' ? 'button-secondary' : 'button'}
                    onClick={() => applyStatus(status)}
                    disabled={busy}
                  >
                    {status === 'ACKNOWLEDGED' ? 'Acknowledge' : humanize(status)}
                  </button>
                ))}
              </div>

              {user?.role === 'HIGH_LEVEL' && !selected.escalatedAlertId && (
                <div className="space-y-2 border-t border-slate-800 pt-4">
                  <label className="label" htmlFor="escalation">
                    Escalate to draft alert (high-level admins)
                  </label>
                  <textarea
                    id="escalation"
                    className="input min-h-20"
                    maxLength={480}
                    value={escalation}
                    onChange={(event) => setEscalation(event.target.value)}
                    placeholder="Alert message to broadcast to the affected barangay…"
                  />
                  <button type="button" className="button" onClick={handleEscalate} disabled={busy}>
                    Create draft alert
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
