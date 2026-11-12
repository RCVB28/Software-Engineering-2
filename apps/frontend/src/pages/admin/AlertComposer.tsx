import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDate } from '../../components/format';
import { ApiError, api } from '../../services/api';
import {
  ALERT_CATEGORIES,
  RESIDENT_ROLES,
  humanize,
  type Alert,
  type AlertCategory,
  type AlertTarget,
  type Barangay,
  type RecipientPreview,
  type ResidentRole
} from '../../types';

interface TargetRow {
  barangayId: string;
  residentRole: string;
}

const emptyTarget: TargetRow = { barangayId: '', residentRole: '' };

function describeTarget(target: AlertTarget, barangays: Barangay[]): string {
  const parts: string[] = [];
  if (target.barangayId) {
    parts.push(barangays.find((barangay) => barangay.id === target.barangayId)?.name ?? target.barangayId);
  }
  if (target.residentRole) parts.push(humanize(target.residentRole));
  return parts.join(' · ') || 'Everyone';
}

export function AlertComposer() {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<AlertCategory>('FLOOD');
  const [targets, setTargets] = useState<TargetRow[]>([{ ...emptyTarget }]);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [draft, setDraft] = useState<Alert | null>(null);
  const [preview, setPreview] = useState<RecipientPreview | null>(null);
  const [recent, setRecent] = useState<Alert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadRecent = () => {
    api.alerts
      .list()
      .then(setRecent)
      .catch(() => setRecent([]));
  };

  useEffect(() => {
    api.barangays.list().then(setBarangays).catch(() => setBarangays([]));
    loadRecent();
  }, []);

  const updateTarget = (index: number, field: keyof TargetRow, value: string) => {
    setTargets((current) =>
      current.map((target, position) => (position === index ? { ...target, [field]: value } : target))
    );
  };

  const toTargets = (): AlertTarget[] =>
    targets.map((target) => ({
      barangayId: target.barangayId || null,
      residentRole: (target.residentRole || null) as ResidentRole | null
    }));

  const validate = (): string | null => {
    if (!content.trim()) return 'Enter an alert message.';
    if (targets.length === 0) return 'Add at least one target.';
    if (targets.some((target) => !target.barangayId && !target.residentRole)) {
      return 'Every target needs a barangay, a resident role, or both.';
    }
    return null;
  };

  const handleSaveDraft = async (event: FormEvent) => {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = draft
        ? await api.alerts.update(draft.id, { content: content.trim(), category, targets: toTargets() })
        : await api.alerts.create({ content: content.trim(), category, targets: toTargets() });
      setDraft(saved);
      setPreview(null);
      loadRecent();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save the draft.');
    } finally {
      setBusy(false);
    }
  };

  const handlePreview = async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      setPreview(await api.alerts.recipients(draft.id));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not preview recipients.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!draft) return;
    if (!window.confirm('Broadcast this alert now? This sends SMS messages and cannot be undone.')) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const confirmed = await api.alerts.confirm(draft.id);
      setDraft(confirmed);
      setPreview(null);
      loadRecent();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Broadcast failed.');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setDraft(null);
    setPreview(null);
    setContent('');
    setTargets([{ ...emptyTarget }]);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="card">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white">Compose Alert</h1>
            <p className="text-sm text-slate-400">
              Draft the message, preview recipients, then explicitly confirm the broadcast.
            </p>
          </div>
          {draft && <StatusBadge status={draft.status} />}
        </div>

        {error && (
          <p className="mb-4 rounded-md border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}

        <form className="space-y-5" onSubmit={handleSaveDraft}>
          <div>
            <label className="label" htmlFor="content">
              Message
            </label>
            <textarea
              id="content"
              className="input min-h-28"
              maxLength={480}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Evacuate immediately to the nearest evacuation center…"
            />
            <p className="mt-1 text-right text-xs text-slate-500">{content.length}/480</p>
          </div>

          <div>
            <label className="label" htmlFor="category">
              Category
            </label>
            <select
              id="category"
              className="input"
              value={category}
              onChange={(event) => setCategory(event.target.value as AlertCategory)}
            >
              {ALERT_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {humanize(item)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="label mb-0">Targets</span>
              <button
                type="button"
                className="button-secondary py-1 text-xs"
                onClick={() => setTargets((current) => [...current, { ...emptyTarget }])}
              >
                Add target
              </button>
            </div>
            <div className="space-y-3">
              {targets.map((target, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <select
                    className="input"
                    value={target.barangayId}
                    onChange={(event) => updateTarget(index, 'barangayId', event.target.value)}
                  >
                    <option value="">All barangays</option>
                    {barangays.map((barangay) => (
                      <option key={barangay.id} value={barangay.id}>
                        {barangay.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="input"
                    value={target.residentRole}
                    onChange={(event) => updateTarget(index, 'residentRole', event.target.value)}
                  >
                    <option value="">All roles</option>
                    {RESIDENT_ROLES.map((item) => (
                      <option key={item} value={item}>
                        {humanize(item)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() =>
                      setTargets((current) =>
                        current.length === 1 ? current : current.filter((_, position) => position !== index)
                      )
                    }
                    disabled={targets.length === 1}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="button" type="submit" disabled={busy}>
              {draft ? 'Update draft' : 'Save draft'}
            </button>
            {draft && draft.status === 'DRAFT' && (
              <>
                <button type="button" className="button-secondary" onClick={handlePreview} disabled={busy}>
                  Preview recipients
                </button>
                <button type="button" className="button" onClick={handleConfirm} disabled={busy}>
                  Confirm &amp; broadcast
                </button>
              </>
            )}
            {draft && (
              <button type="button" className="button-secondary" onClick={reset}>
                New alert
              </button>
            )}
          </div>
        </form>

        {preview && (
          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-sm font-semibold text-slate-200">
              {preview.count} eligible recipient{preview.count === 1 ? '' : 's'}
            </p>
            <ul className="mt-2 max-h-56 space-y-1 overflow-auto text-sm text-slate-400">
              {preview.recipients.map((recipient) => (
                <li key={recipient.residentId} className="flex justify-between gap-4">
                  <span>{recipient.displayName ?? recipient.residentId}</span>
                  <span className="text-xs text-slate-500">{recipient.phoneNumbers.join(', ')}</span>
                </li>
              ))}
            </ul>
            {preview.count === 0 && (
              <p className="mt-2 text-sm text-amber-400">
                No eligible recipients. Check consent, phone numbers, and category preferences.
              </p>
            )}
          </div>
        )}

        {draft && draft.status !== 'DRAFT' && (
          <div className="mt-6 rounded-lg border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-200">
            Alert {draft.status.toLowerCase()} at {formatDate(draft.confirmedAt)}.{' '}
            <Link className="underline" to={`/admin/alerts/${draft.id}/deliveries`}>
              View delivery results
            </Link>
          </div>
        )}
      </section>

      <aside className="card h-fit">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Recent alerts
        </h2>
        <div className="space-y-3">
          {recent.length === 0 && <p className="text-sm text-slate-500">No alerts yet.</p>}
          {recent.map((alert) => (
            <Link
              key={alert.id}
              to={`/admin/alerts/${alert.id}/deliveries`}
              className="block rounded-lg border border-slate-800 p-3 transition hover:border-slate-600"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-200">{humanize(alert.category)}</span>
                <StatusBadge status={alert.status} />
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-slate-400">{alert.content}</p>
              <p className="mt-1 text-xs text-slate-500">
                {alert.targets.map((target) => describeTarget(target, barangays)).join(' · ')}
              </p>
            </Link>
          ))}
        </div>
      </aside>
    </div>
  );
}
