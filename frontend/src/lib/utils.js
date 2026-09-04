import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatScore(score) {
  return (score || 0).toFixed(3);
}

export function formatRole(role) {
  if (!role) return 'Unknown';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function formatBailStatus(status) {
  const map = {
    on_bail: 'On Bail',
    none: 'No Record',
    absconding: 'Absconding',
  };
  return map[status] || status || 'Unknown';
}

export function formatEventType(type) {
  const map = {
    call: 'Call Record',
    financial: 'Financial Transaction',
    transaction: 'Financial Transaction',
    colocation: 'Co-location Event',
    case: 'Case Mention',
    communication: 'Communication',
  };
  return map[type?.toLowerCase()] || type || 'Event';
}

export function formatTimestamp(ts) {
  if (!ts) return 'Unknown';
  try {
    const d = new Date(ts);
    if (isNaN(d)) return ts;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

export function getSignalLabel(type) {
  const map = {
    call: 'Communication',
    communication: 'Communication',
    comm_edge: 'Communication',
    financial: 'Financial',
    financial_edge: 'Financial',
    transaction: 'Financial',
    colocation: 'Co-location',
    location: 'Co-location',
    location_edge: 'Co-location',
    case: 'Case Linkage',
    case_edge: 'Case Linkage',
    fir: 'Case Linkage',
  };
  return map[type?.toLowerCase()] || type || 'Unknown';
}

/** Fusion engine weights — keep UI contribution bars aligned with backend. */
export const FUSION_WEIGHTS = {
  communication: 0.25,
  'co-location': 0.3,
  financial: 0.3,
  'case linkage': 0.15,
};

export function pairKey(a, b) {
  return [a, b].sort().join('|');
}
