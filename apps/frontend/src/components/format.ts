import { humanize, type AlertTarget, type Barangay } from '../types';

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function describeTarget(target: AlertTarget, barangays: Barangay[]): string {
  const parts: string[] = [];
  if (target.barangayId) {
    parts.push(
      barangays.find((barangay) => barangay.id === target.barangayId)?.name ??
        target.barangayId
    );
  }
  if (target.residentRole) parts.push(humanize(target.residentRole));
  return parts.join(' / ') || 'Everyone';
}