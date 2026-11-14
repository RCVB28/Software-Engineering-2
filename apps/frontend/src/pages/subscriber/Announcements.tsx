import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDate } from '../../components/format';
import { ApiError, api } from '../../services/api';
import { humanize, type Alert, type EmergencyReport } from '../../types';

export function Announcements() {
  const [announcements, setAnnouncements] = useState<Alert[]>([]);
  const [reports, setReports] = useState<EmergencyReport[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.residents.announcements(), api.residents.reports()])
      .then(([alerts, ownReports]) => {
        setAnnouncements(alerts);
        setReports(ownReports);
      })
      .catch((caught) => {
        setError(caught instanceof ApiError ? caught.message : 'Could not load announcements.');
      });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Announcements</h1>
          <p className="text-sm text-slate-400">
            Alerts that target your barangay or resident role appear here.
          </p>
        </div>
        <Link className="text-sm underline text-slate-400" to="/resident/history">
          View my alert history
        </Link>
      </div>

      {error && (
        <p className="rounded-md border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {announcements.length === 0 && (
          <div className="card text-sm text-slate-500">No announcements yet.</div>
        )}
        {announcements.map((alert) => (
          <article key={alert.id} className="card">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={alert.status} />
              <span className="text-sm font-semibold text-slate-200">{humanize(alert.category)}</span>
              <span className="text-xs text-slate-500">{formatDate(alert.createdAt)}</span>
            </div>
            <p className="text-slate-200">{alert.content}</p>
          </article>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          My report history
        </h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Severity</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-slate-500" colSpan={4}>
                  You have not submitted any reports.
                </td>
              </tr>
            )}
            {reports.map((report) => (
              <tr key={report.id} className="border-b border-slate-800/60">
                <td className="px-3 py-2">{humanize(report.category)}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={report.severity} />
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={report.status} />
                </td>
                <td className="px-3 py-2 text-xs text-slate-400">{formatDate(report.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
