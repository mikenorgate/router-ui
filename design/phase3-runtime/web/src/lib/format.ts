export function number(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(value) : 'Unavailable';
}
export function bytes(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Unavailable';
  const n = Math.max(0, value);
  const unit = n >= 1024 ** 3 ? 'GiB' : n >= 1024 ** 2 ? 'MiB' : n >= 1024 ? 'KiB' : 'B';
  const factor = { GiB: 1024 ** 3, MiB: 1024 ** 2, KiB: 1024, B: 1 }[unit];
  return `${number(n / factor)} ${unit}`;
}
export function timestamp(value?: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Observation time unavailable';
  return `${new Date(value).toISOString().replace('T', ' ').slice(0, 19)} UTC`;
}
export function clock(value: string): string {
  return Number.isFinite(Date.parse(value)) ? new Date(value).toISOString().slice(11, 16) : 'Unknown';
}
export function text(value: unknown, fallback = 'Unavailable'): string {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
export function sampling(rate?: number | null): string {
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return 'Sampling rate unavailable';
  if (rate === 1) return 'Unsampled';
  return rate < 1 ? `Sampled · ${number(rate * 100)}%` : `Sampled · 1 in ${number(rate)}`;
}
export function age(seconds?: number | null): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds < 60) return `${Math.round(seconds)} s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return `${Math.round(seconds / 86400)} d ago`;
}
export function endpoint(ip?: string, port?: number | null): string {
  if (!ip) return 'Address unavailable';
  return `${ip.includes(':') ? `[${ip}]` : ip}${port == null ? '' : `:${port}`}`;
}
export function expired(value?: string | null): boolean { return !!value && Date.parse(value) < Date.now(); }
