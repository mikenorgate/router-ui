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
const BIT_RATE_FACTORS: Record<string, number> = { 'bit/s': 1, 'kbit/s': 1e3, 'Mbit/s': 1e6, 'Gbit/s': 1e9, 'Tbit/s': 1e12 };
const BIT_RATE_STEPS: [number, string][] = [[1e12, 'Tbit/s'], [1e9, 'Gbit/s'], [1e6, 'Mbit/s'], [1e3, 'kbit/s'], [1, 'bit/s']];
export interface ScaledUnit { value: string; unit: string }
export function rate(value: number | null | undefined, unit?: string): ScaledUnit {
  const rawUnit = unit || '';
  if (typeof value !== 'number' || !Number.isFinite(value)) return { value: '—', unit: rawUnit };
  const factor = BIT_RATE_FACTORS[rawUnit];
  if (factor === undefined) return { value: number(value), unit: rawUnit };
  const bitsPerSecond = value * factor;
  const magnitude = Math.abs(bitsPerSecond);
  const [stepFactor, stepUnit] = BIT_RATE_STEPS.find(([f]) => magnitude >= f) || BIT_RATE_STEPS[BIT_RATE_STEPS.length - 1]!;
  return { value: number(bitsPerSecond / stepFactor), unit: stepUnit };
}
export interface AxisScale { unit: string; factor: number; step: number; max: number }
const NICE_STEP_FRACTIONS = [1, 2, 2.5, 5, 10] as const;
export function axisScale(maxValue: number, unit?: string): AxisScale {
  const rawUnit = unit || '';
  const safeMax = typeof maxValue === 'number' && Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 1;
  const rateFactor = BIT_RATE_FACTORS[rawUnit];
  if (rateFactor !== undefined) {
    const bitsPerSecond = safeMax * rateFactor;
    const [stepFactor, stepUnit] = BIT_RATE_STEPS.find(([f]) => bitsPerSecond >= f) || BIT_RATE_STEPS[BIT_RATE_STEPS.length - 1]!;
    return niceScale(bitsPerSecond / stepFactor, stepUnit, rateFactor / stepFactor);
  }
  return niceScale(safeMax, rawUnit, 1);
}
function niceScale(displayMax: number, unit: string, factor: number): AxisScale {
  const rough = displayMax / 3;
  const base = 10 ** Math.floor(Math.log10(rough));
  const fraction = NICE_STEP_FRACTIONS.find(f => rough <= f * base) ?? 10;
  const step = fraction * base;
  return { unit, factor, step, max: step * 3 };
}
const compactCounts = new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 });
export function count(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Unavailable';
  return Math.abs(value) < 1000 ? number(value) : compactCounts.format(value).toUpperCase();
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
