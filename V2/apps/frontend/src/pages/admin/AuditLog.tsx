import { useEffect, useState, type FormEvent } from 'react';
import { formatDate } from '../../components/format';
import { ApiError, api } from '../../services/api';
import { humanize, type AuditEntry } from '../../types';

export function AuditLog() {
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      setEntries(
        await api.audit.list({
          ...(entityType ? { entityType } : {}),
          ...(from ? { from: new Date(from).toISOString() } : {}),
          ...(to ? { to: new Date(to).toISOString() } : {})
        })
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load audit entries.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleFilter = (event: FormEvent) => {
    event.preventDefault();
    load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Audit Log</h1>
        <p className="text-sm text-slate-400">
          Critical administrative actions are retained for one year.
        </p>
      </div>

      <form className="card grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={handleFilter}>
        <div>
          <label className="label" htmlFor="entityType">
            Entity type
          </label>
          <input
            id="entityType"
            className="input"
            value={entityType}
            onChange={(event) => setEntityType(event.target.value)}
            placeholder="Alert, Administrator…"
          />
        </div>
        <div>
          <label className="label" htmlFor="from">
            From
          </label>
          <input
            id="from"
            className="input"
            type="datetime-local"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="to">
            To
          </label>
          <input
            id="to"
            className="input"
            type="datetime-local"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
        <div className="flex items-end">
          <button className="button" type="submit" disabled={busy}>
            {busy ? 'Loading…' : 'Apply'}
          </button>
        </div>
      </form>

      {error && (
        <p className="rounded-md border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Entity</th>
              <th className="px-3 py-2">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-slate-500" colSpan={5}>
                  No audit entries match the filters.
                </td>
              </tr>
            )}
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-slate-800/60 align-top">
                <td className="px-3 py-2 text-xs text-slate-400">{formatDate(entry.createdAt)}</td>
                <td className="px-3 py-2 text-xs">
                  <span className="font-semibold text-slate-200">{humanize(entry.actorType)}</span>
                  <span className="block font-mono text-slate-500">{entry.actorId ?? '—'}</span>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-amber-300">{entry.action}</td>
                <td className="px-3 py-2 text-xs">
                  <span className="text-slate-200">{entry.entityType}</span>
                  <span className="block font-mono text-slate-500">{entry.entityId ?? '—'}</span>
                </td>
                <td className="max-w-xs px-3 py-2 font-mono text-xs text-slate-400">
                  {entry.metadata ? JSON.stringify(entry.metadata) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
