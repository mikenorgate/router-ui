import { describe, expect, it } from 'vitest';
import { axisScale, count, rate } from '../lib/format';
describe('rate', () => {
  it('keeps small bit/s values at their raw unit', () => {
    expect(rate(512.4, 'bit/s')).toEqual({ value: '512.4', unit: 'bit/s' });
  });
  it('scales raw bits per second up to kbit/s and Mbit/s', () => {
    expect(rate(1500, 'bit/s')).toEqual({ value: '1.5', unit: 'kbit/s' });
    expect(rate(2903738.04, 'bit/s')).toEqual({ value: '2.9', unit: 'Mbit/s' });
  });
  it('scales into Gbit/s', () => {
    expect(rate(968400000, 'bit/s')).toEqual({ value: '968.4', unit: 'Mbit/s' });
    expect(rate(1200000000, 'bit/s')).toEqual({ value: '1.2', unit: 'Gbit/s' });
  });
  it('normalises already-prefixed producer units', () => {
    expect(rate(58.2, 'Mbit/s')).toEqual({ value: '58.2', unit: 'Mbit/s' });
    expect(rate(0.0012, 'Gbit/s')).toEqual({ value: '1.2', unit: 'Mbit/s' });
  });
  it('places zero at the base unit', () => {
    expect(rate(0, 'bit/s')).toEqual({ value: '0', unit: 'bit/s' });
  });
  it('passes unknown units through with the original formatting', () => {
    expect(rate(24, 'ms')).toEqual({ value: '24', unit: 'ms' });
    expect(rate(99, '%')).toEqual({ value: '99', unit: '%' });
  });
  it('renders missing values as a dash with the raw unit preserved', () => {
    expect(rate(null, 'bit/s')).toEqual({ value: '—', unit: 'bit/s' });
    expect(rate(undefined)).toEqual({ value: '—', unit: '' });
  });
});
describe('axisScale', () => {
  it('scales raw bit/s axes into readable display units', () => {
    const scale = axisScale(2903738.04, 'bit/s');
    expect(scale.unit).toBe('Mbit/s'); expect(scale.factor).toBeCloseTo(1e-6); expect(scale.step).toBe(1); expect(scale.max).toBe(3);
  });
  it('uses nice 1/2/2.5/5 steps for already-readable units', () => {
    const scale = axisScale(122, 'Mbit/s');
    expect(scale.unit).toBe('Mbit/s'); expect(scale.factor).toBe(1); expect(scale.step).toBe(50); expect(scale.max).toBe(150);
  });
  it('promotes gigabit-scale lanes to Gbit/s', () => {
    const scale = axisScale(2e9, 'bit/s');
    expect(scale.unit).toBe('Gbit/s'); expect(scale.max).toBe(3);
  });
  it('passes non-rate units through with a numeric scale', () => {
    const scale = axisScale(24, 'ms');
    expect(scale.unit).toBe('ms'); expect(scale.factor).toBe(1); expect(scale.max).toBe(30);
  });
  it('guards zero and invalid maxima', () => {
    expect(axisScale(0, 'Mbit/s').max).toBeGreaterThan(0);
    expect(axisScale(Number.NaN, 'ms').max).toBeGreaterThan(0);
  });
});
describe('count', () => {
  it('keeps small counts exact', () => {
    expect(count(3)).toBe('3');
    expect(count(999)).toBe('999');
  });
  it('compacts large counts to K and M', () => {
    expect(count(1234)).toBe('1.2K');
    expect(count(48172)).toBe('48.2K');
    expect(count(22903738)).toBe('22.9M');
  });
  it('labels missing counts as unavailable', () => {
    expect(count(null)).toBe('Unavailable');
    expect(count(undefined)).toBe('Unavailable');
  });
});
