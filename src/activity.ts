import type { Profile } from './keyboard';

export type Session = { at: string; mode: string; seconds: number; wpm: number; accuracy: number; errors: number };
export type Usage = {
  keys: Record<string, number>; layers: Record<number, number>; errors?: Record<number, number>; changes: number; holds: number; taps: number;
};
export const emptyUsage: Usage = { keys: {}, layers: {}, changes: 0, holds: 0, taps: 0 };
export type Activity = { sessions: Session[]; usage: Record<Profile['geometry'], Usage>; records: Record<string, number> };
export const emptyActivity: Activity = { sessions: [], usage: { studio: emptyUsage, m57: emptyUsage }, records: {} };
export const activityKey = 'cornetype.activity.v1';
export const profileKey = 'cornetype.profile.v1';

export function readLocal(key: string) {
  try { return localStorage.getItem(key); }
  catch { return null; }
}

export function writeLocal(key: string, value: string) {
  try { localStorage.setItem(key, value); }
  catch { return false; }
  return true;
}

export function loadActivity(): Activity {
  try {
    const stored = JSON.parse(readLocal(activityKey) ?? 'null') as Activity | null;
    if (stored && Array.isArray(stored.sessions) && stored.usage?.studio && stored.usage?.m57 && stored.records) return stored;
  } catch { /* A fresh store is available if storage is corrupt. */ }
  return emptyActivity;
}

export function typingStats(correct: number, attempts: number, seconds: number, intervals: number[]) {
  const mean = intervals.reduce((sum, value) => sum + value, 0) / (intervals.length || 1);
  const variance = intervals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (intervals.length || 1);
  return {
    wpm: seconds > 0 ? Math.round(correct * 12 / seconds) : 0,
    accuracy: attempts ? Math.round(correct * 1000 / attempts) / 10 : 100,
    consistency: intervals.length >= 3 && mean > 0 ? Math.max(0, Math.round(100 * (1 - Math.sqrt(variance) / mean))) : null,
  };
}

export const formatTime = (seconds: number) => [Math.floor(seconds / 60), Math.floor(seconds % 60)].map(value => String(value).padStart(2, '0')).join(':');
export const number = (value: number, digits = 0) => value.toLocaleString('es-ES', { maximumFractionDigits: digits });
