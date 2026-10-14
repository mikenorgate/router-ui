/**
 * Policy-origin predicates shared by the UI and the demo fixture.
 * This module is deliberately import-free so it can be used from api/demo
 * without creating module cycles. The backend records unknown origin as a
 * blank producer or the literal "unknown" (see policy evidence filtering).
 */
export function producerUnknown(producer?: string | null): boolean {
  const value = (producer || '').trim();
  return !value || value.toLowerCase() === 'unknown';
}
export function producerLabel(producer?: string | null): string {
  return producerUnknown(producer) ? 'Origin unavailable' : (producer || '').trim();
}
