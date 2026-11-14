import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertForm } from '../../components/AlertForm';
import { StatusBadge } from '../../components/StatusBadge';
import { describeTarget, formatDate } from '../../components/format';
import { ApiError, api } from '../../services/api';
import {
  humanize,
  type Alert,
  type AlertInput,
  type Barangay,
  type RecipientPreview
} from '../../types';

const emptyAlert: AlertInput = {
  content: '',
  category: 'FLOOD',
  targets: [{ barangayId: null, residentRole: null }]
};

export function AlertComposer() {
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

  const handleSave = async (input: AlertInput) => {
    setBusy(true);
    setError(null);
    try {
      const saved = draft
        ? await api.alerts.update(draft.id, input)
        : await api.alerts.create(input);
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
    setError(null);
  };

  const initialValue: AlertInput = draft
    ? { content: draft.content, category: draft.category, targets: draft.targets }
    : emptyAlert;
  const isDraft = draft?.status === 'DRAFT';

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

        <AlertForm
          key={draft ? `${draft.id}-${draft.updatedAt}` : 'new'}
          barangays={barangays}
          initialValue={initialValue}
          submitLabel={draft ? 'Update draft' : 'Save draft'}
          readOnly={Boolean(draft) && !isDraft}
          busy={busy}
          onSubmit={handleSave}
        />

        <div className="mt-5 flex flex-wrap gap-3">
          {isDraft && (
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

        {isDraft && (
          <div className="mt-6 rounded-lg border border-sky-800 bg-sky-950/40 p-4 text-sm text-sky-200">
            Draft saved.{' '}
            <Link className="underline" to={`/admin/alerts/${draft.id}`}>
              Open the draft page
            </Link>{' '}
            to preview recipients and send the alert.
          </div>
        )}

        {draft && !isDraft && (
          <div className="mt-6 rounded-lg border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-200">
            Alert {draft.status.toLowerCase()} at {formatDate(draft.confirmedAt)}.{' '}
            <Link className="underline" to={`/admin/alerts/${draft.id}/deliveries`}>
              View delivery results
            </Link>
          </div>
        )}
      </section>

      <aside className="card h-fit">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Recent alerts
          </h2>
          <Link className="text-xs underline text-slate-400" to="/admin/history">
            View all history
          </Link>
        </div>
        <div className="space-y-3">
          {recent.length === 0 && <p className="text-sm text-slate-500">No alerts yet.</p>}
          {recent.map((alert) => (
            <Link
              key={alert.id}
              to={
                alert.status === 'DRAFT'
                  ? `/admin/alerts/${alert.id}`
                  : `/admin/alerts/${alert.id}/deliveries`
              }
              className="block rounded-lg border border-slate-800 p-3 transition hover:border-slate-600"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-200">{humanize(alert.category)}</span>
                <StatusBadge status={alert.status} />
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-slate-400">{alert.content}</p>
              <p className="mt-1 text-xs text-slate-500">
                {alert.targets.map((target) => describeTarget(target, barangays)).join(' / ')}
              </p>
            </Link>
          ))}
        </div>
      </aside>
    </div>
  );
}
