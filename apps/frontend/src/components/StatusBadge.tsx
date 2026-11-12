import { humanize } from '../types';

const COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-700 text-slate-100',
  CONFIRMED: 'bg-amber-600 text-white',
  SENDING: 'bg-sky-600 text-white',
  COMPLETED: 'bg-emerald-600 text-white',
  NEW: 'bg-rose-600 text-white',
  ACKNOWLEDGED: 'bg-amber-600 text-white',
  RESOLVED: 'bg-emerald-600 text-white',
  DISMISSED: 'bg-slate-600 text-slate-100',
  SUCCESS: 'bg-emerald-600 text-white',
  FAILURE: 'bg-rose-600 text-white',
  DELAYED: 'bg-amber-600 text-white',
  SUBMITTED: 'bg-sky-600 text-white',
  LOW: 'bg-slate-600 text-slate-100',
  MEDIUM: 'bg-sky-600 text-white',
  HIGH: 'bg-amber-600 text-white',
  CRITICAL: 'bg-rose-600 text-white'
};

export function StatusBadge({ status }: { status: string }) {
  const classes = COLORS[status] ?? 'bg-slate-700 text-slate-100';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${classes}`}>
      {humanize(status)}
    </span>
  );
}
