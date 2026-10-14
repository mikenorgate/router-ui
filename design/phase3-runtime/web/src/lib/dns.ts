// DNS observation accessors. The backend record carries query / type /
// result / answers (a string list) plus answer_records with TTLs; older
// fixtures may still carry query_name / query_type / rcode and a numeric
// answer count. Backend names always win; the fallbacks exist so fixture
// compatibility never requires inventing values.
import type { DnsObservation } from './contracts';

export const dnsQuery = (d: DnsObservation) => d.query ?? d.query_name;
export const dnsType = (d: DnsObservation) => d.type ?? d.query_type;
export const dnsResult = (d: DnsObservation) => d.result ?? d.rcode;

/** Answer values exactly as recorded. Count-only fixtures yield no values —
 * callers then show the count as a labelled fallback, never invented values. */
export function dnsAnswerValues(d: DnsObservation): string[] | null {
  if (Array.isArray(d.answers)) return d.answers;
  if (d.answer_records?.length) {
    const values = d.answer_records.map(record => record.value).filter((value): value is string => !!value);
    if (values.length) return values;
  }
  return null;
}

/** Recorded answer count, from whichever shape the producer supplied. An
 * unobserved response has no count — unknown answers are never a zero. */
export function dnsAnswerCount(d: DnsObservation): number | null {
  if ((d.result ?? d.rcode) === 'UNOBSERVED_RESPONSE') return null;
  if (typeof d.answer_count === 'number') return d.answer_count;
  if (Array.isArray(d.answers)) return d.answers.length;
  if (typeof d.answers === 'number') return d.answers;
  if (d.answer_records) return d.answer_records.length;
  return null;
}
