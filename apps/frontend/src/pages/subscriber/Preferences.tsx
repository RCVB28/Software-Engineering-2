import { useEffect, useState } from 'react';
import { ApiError, api } from '../../services/api';
import {
  ALERT_CATEGORIES,
  humanize,
  type AlertCategory,
  type AlertPreference
} from '../../types';

export function Preferences() {
  const [granted, setGranted] = useState(false);
  const [policyVersion, setPolicyVersion] = useState('v1');
  const [preferences, setPreferences] = useState<Record<AlertCategory, boolean>>(
    () =>
      Object.fromEntries(ALERT_CATEGORIES.map((category) => [category, true])) as Record<
        AlertCategory,
        boolean
      >
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.residents.consent(), api.residents.preferences()])
      .then(([consent, stored]) => {
        setGranted(consent.granted);
        if (consent.policyVersion && consent.policyVersion !== 'none') {
          setPolicyVersion(consent.policyVersion);
        }
        setPreferences((current) => {
          const next = { ...current };
          stored.forEach((preference) => {
            next[preference.category] = preference.optedIn;
          });
          return next;
        });
      })
      .catch((caught) => {
        setError(caught instanceof ApiError ? caught.message : 'Could not load preferences.');
      });
  }, []);

  const saveConsent = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.residents.setConsent(granted, policyVersion);
      setNotice(granted ? 'Consent recorded.' : 'Consent revoked.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save consent.');
    } finally {
      setBusy(false);
    }
  };

  const savePreferences = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const payload: AlertPreference[] = ALERT_CATEGORIES.map((category) => ({
        category,
        optedIn: preferences[category]
      }));
      await api.residents.setPreferences(payload);
      setNotice('Alert preferences saved.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save preferences.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Consent &amp; Alert Preferences</h1>
        <p className="text-sm text-slate-400">
          You only receive broadcasts when consent is granted and the category is enabled.
        </p>
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

      <section className="card space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          SMS consent
        </h2>
        <label className="flex items-center gap-3 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={granted}
            onChange={(event) => setGranted(event.target.checked)}
          />
          I agree to receive emergency SMS alerts on my linked phone numbers.
        </label>
        <div className="max-w-xs">
          <label className="label" htmlFor="policyVersion">
            Policy version
          </label>
          <input
            id="policyVersion"
            className="input"
            value={policyVersion}
            onChange={(event) => setPolicyVersion(event.target.value)}
          />
        </div>
        <button type="button" className="button" onClick={saveConsent} disabled={busy}>
          Save consent
        </button>
      </section>

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Alert categories
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {ALERT_CATEGORIES.map((category) => (
            <label
              key={category}
              className="flex items-center gap-3 rounded-md border border-slate-800 px-3 py-2 text-sm text-slate-200"
            >
              <input
                type="checkbox"
                checked={preferences[category]}
                onChange={(event) =>
                  setPreferences((current) => ({ ...current, [category]: event.target.checked }))
                }
              />
              {humanize(category)}
            </label>
          ))}
        </div>
        <button type="button" className="button" onClick={savePreferences} disabled={busy}>
          Save preferences
        </button>
      </section>
    </div>
  );
}
