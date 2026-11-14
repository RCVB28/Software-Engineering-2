import { useState, type FormEvent } from 'react';
import {
  ALERT_CATEGORIES,
  RESIDENT_ROLES,
  humanize,
  type AlertCategory,
  type AlertInput,
  type AlertTarget,
  type Barangay,
  type ResidentRole
} from '../types';
import { describeTarget } from './format';

interface TargetRow {
  barangayId: string;
  residentRole: string;
}

interface AlertFormProps {
  barangays: Barangay[];
  initialValue?: Partial<AlertInput>;
  submitLabel?: string;
  readOnly?: boolean;
  busy?: boolean;
  onSubmit: (input: AlertInput) => void | Promise<void>;
}

function toRows(targets: AlertTarget[] | undefined): TargetRow[] {
  return (targets ?? []).map((target) => ({
    barangayId: target.barangayId ?? '',
    residentRole: target.residentRole ?? ''
  }));
}

function toTargets(rows: TargetRow[]): AlertTarget[] {
  return rows.map((target) => ({
    barangayId: target.barangayId || null,
    residentRole: (target.residentRole || null) as ResidentRole | null
  }));
}

export function AlertForm({
  barangays,
  initialValue,
  submitLabel = 'Save draft',
  readOnly = false,
  busy = false,
  onSubmit
}: AlertFormProps) {
  const [content, setContent] = useState(initialValue?.content ?? '');
  const [category, setCategory] = useState<AlertCategory>(initialValue?.category ?? 'FLOOD');
  const [targets, setTargets] = useState<TargetRow[]>(toRows(initialValue?.targets));
  const [error, setError] = useState<string | null>(null);

  const updateTarget = (index: number, field: keyof TargetRow, value: string) => {
    setTargets((current) =>
      current.map((target, position) => (position === index ? { ...target, [field]: value } : target))
    );
  };

  const validate = (): string | null => {
    if (!content.trim()) return 'Enter an alert message.';
    if (targets.length === 0) return 'Add at least one target.';
    if (targets.some((target) => !target.barangayId && !target.residentRole)) {
      return 'Every target needs a barangay, a resident role, or both.';
    }
    return null;
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    void onSubmit({
      content: content.trim(),
      category,
      targets: toTargets(targets)
    });
  };

  if (readOnly) {
    return (
      <div className="space-y-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Read only</p>
        <div>
          <span className="label">Category</span>
          <p className="text-sm font-semibold text-slate-200">{humanize(category)}</p>
        </div>
        <p className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200">
          {content}
        </p>
        <div>
          <span className="label">Targets</span>
          <ul className="space-y-1 text-sm text-slate-300">
            {toTargets(targets).map((target, index) => (
              <li key={index}>{describeTarget(target, barangays)}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {error && (
        <p className="rounded-md border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

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
          placeholder="Evacuate immediately to the nearest evacuation center."
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
            onClick={() => setTargets((current) => [...current, { barangayId: '', residentRole: '' }])}
          >
            Add target
          </button>
        </div>
        <div className="space-y-3">
          {targets.map((target, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <select
                className="input"
                aria-label={`Target ${index + 1} barangay`}
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
                aria-label={`Target ${index + 1} role`}
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

      <button className="button" type="submit" disabled={busy}>
        {submitLabel}
      </button>
    </form>
  );
}
