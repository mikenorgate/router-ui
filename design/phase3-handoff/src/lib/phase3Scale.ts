// Standalone scale helper for the rc.10-compatible Phase 3 handoff.
const BIT_RATE_FACTORS: Record<string, number> = { 'bit/s': 1, 'kbit/s': 1e3, 'Mbit/s': 1e6, 'Gbit/s': 1e9, 'Tbit/s': 1e12 };
const BIT_RATE_STEPS: [number, string][] = [[1e12, 'Tbit/s'], [1e9, 'Gbit/s'], [1e6, 'Mbit/s'], [1e3, 'kbit/s'], [1, 'bit/s']];
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
