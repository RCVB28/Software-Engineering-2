import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertForm } from '../../components/AlertForm';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDate } from '../../components/format';
import { ApiError, api } from '../../services/api';
import {
  humanize,
  type Alert,
  type AlertInput,
  type Barangay,
  type RecipientPreview
} from '../../types';

export function AlertDetail() {
  const { alertId = '' } = useParams();
  const [alert, setAlert] = useState<Alert | null>(null);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [preview, setPreview] = useState<RecipientPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAlert = useCallback(async () => {
    try {
      setAlert(await api.alerts.get(alertId));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load the alert.');
    }
  }, [alertId]);

  useEffect(() => {
    loadAlert();
    api.barangays
      .list()
      .then(setBarangays)
      .catch(() => setBarangays([]));
  }, [loadAlert]);

  const handleSave = async (input: AlertInput) => {
    setBusy(true);
    setError(null);
    try {
      setAlert(await api.alerts.update(alertId, input));
      setPreview(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save the draft.');
    } finally {
      setBusy(false);
    }
  };

  const handlePreview = async () => {
    setBusy(true);
    setError(null);
    try {
      setPreview(await api.alerts.recipients(alertId));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not preview recipients.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!window.confirm('Broadcast this alert now? This sends SMS messages and cannot be undone.')) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setAlert(await api.alerts.confirm(alertId));
      setPreview(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Broadcast failed.');
    } finally {
      setBusy(false);
    }
  };

  const initialValue: AlertInput | undefined = alert
    ? { content: alert.content, category: alert.category, targets: alert.targets }
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Alert Details</h1>
          <p className="text-sm text-slate-400">
            Review the draft, preview recipients, then send the broadcast.
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
        <section className="card space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={alert.status} />
            <span className="text-sm font-semibold text-slate-200">{humanize(alert.category)}</span>
            <span className="text-xs text-slate-500">Created {formatDate(alert.createdAt)}</span>
            {alert.confirmedAt && (
              <span className="text-xs text-slate-500">Sent {formatDate(alert.confirmedAt)}</span>
            )}
          </div>

          <AlertForm
            key={`${alert.id}-${alert.updatedAt}`}
            barangays={barangays}
            initialValue={initialValue}
            submitLabel="Save changes"
            readOnly={alert.status !== 'DRAFT'}
            busy={busy}
            onSubmit={handleSave}
          />

          {preview && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
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

          <div className="flex flex-wrap gap-3">
            {alert.status === 'DRAFT' ? (
              <>
                <button type="button" className="button-secondary" onClick={handlePreview} disabled={busy}>
                  Preview recipients
                </button>
                <button type="button" className="button" onClick={handleConfirm} disabled={busy}>
                  {busy ? 'Sending...' : 'Send alert'}
                </button>
              </>
            ) : (
              <Link className="button" to={`/admin/alerts/${alert.id}/deliveries`}>
                View delivery results
              </Link>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
