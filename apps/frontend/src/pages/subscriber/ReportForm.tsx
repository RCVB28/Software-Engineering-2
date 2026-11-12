import { useState, type FormEvent } from 'react';
import { ApiError, api } from '../../services/api';
import {
  ALERT_CATEGORIES,
  REPORT_SEVERITIES,
  humanize,
  type AlertCategory,
  type EmergencyReport,
  type ReportSeverity
} from '../../types';

export function ReportForm() {
  const [category, setCategory] = useState<AlertCategory>('FIRE');
  const [severity, setSeverity] = useState<ReportSeverity>('MEDIUM');
  const [description, setDescription] = useState('');
  const [locationMode, setLocationMode] = useState<'address' | 'coordinates'>('address');
  const [addressText, setAddressText] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [submitted, setSubmitted] = useState<EmergencyReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const report = await api.reports.submit({
        category,
        severity,
        description: description.trim(),
        ...(locationMode === 'address'
          ? { addressText: addressText.trim() }
          : { latitude: Number(latitude), longitude: Number(longitude) })
      });
      setSubmitted(report);
      setDescription('');
      setAddressText('');
      setLatitude('');
      setLongitude('');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not submit the report.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Submit an Emergency Report</h1>
        <p className="text-sm text-slate-400">
          Reports go to the administrators responsible for your barangay.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}
      {submitted && (
        <p className="rounded-md border border-emerald-800 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200">
          Report stored with status {submitted.status}. Reference {submitted.id}.
        </p>
      )}

      <form className="card space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
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
            <label className="label" htmlFor="severity">
              Severity
            </label>
            <select
              id="severity"
              className="input"
              value={severity}
              onChange={(event) => setSeverity(event.target.value as ReportSeverity)}
            >
              {REPORT_SEVERITIES.map((item) => (
                <option key={item} value={item}>
                  {humanize(item)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            className="input min-h-32"
            maxLength={500}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
            placeholder="Describe what is happening and who is affected…"
          />
          <p className={`mt-1 text-right text-xs ${description.length > 450 ? 'text-amber-400' : 'text-slate-500'}`}>
            {description.length}/500
          </p>
        </div>

        <div>
          <span className="label">Location</span>
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              className={`button-secondary py-1 text-xs ${locationMode === 'address' ? 'border-alert-500' : ''}`}
              onClick={() => setLocationMode('address')}
            >
              Street address
            </button>
            <button
              type="button"
              className={`button-secondary py-1 text-xs ${locationMode === 'coordinates' ? 'border-alert-500' : ''}`}
              onClick={() => setLocationMode('coordinates')}
            >
              Coordinates
            </button>
          </div>
          {locationMode === 'address' ? (
            <input
              className="input"
              value={addressText}
              onChange={(event) => setAddressText(event.target.value)}
              placeholder="Purok, street, landmark"
              required
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <input
                className="input"
                type="number"
                step="any"
                min={-90}
                max={90}
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
                placeholder="Latitude"
                required
              />
              <input
                className="input"
                type="number"
                step="any"
                min={-180}
                max={180}
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
                placeholder="Longitude"
                required
              />
            </div>
          )}
        </div>

        <button className="button w-full" type="submit" disabled={busy}>
          {busy ? 'Submitting…' : 'Submit report'}
        </button>
      </form>
    </div>
  );
}
