export type Tone = 'plain' | 'good' | 'warn' | 'bad' | 'unknown';
export function toneFor(status?: string): Tone {
  const value = (status || '').toLowerCase();
  if (/unknown|unsupported|unobserved|unavailable|missing/.test(value)) return 'unknown';
  if (/stale|sampled|partial|expired|warning|degraded/.test(value)) return 'warn';
  if (/blocked|denied|deny|error|down|failed|critical/.test(value)) return 'bad';
  if (/allowed|allow|current|up|recently observed|healthy|ready/.test(value)) return 'good';
  return 'plain';
}
export function Badge({ children, tone = 'plain' }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`badge ${tone}`}><span aria-hidden="true">{{ plain: '○', good: '✓', warn: '△', bad: '×', unknown: '?' }[tone]}</span>{children}</span>;
}
export function Status({ value }: { value?: string }) { return <Badge tone={toneFor(value)}>{value || 'Unknown'}</Badge>; }
export function Evidence({ installed, applicable, observed }: { installed?: boolean | null; applicable?: boolean | null; observed?: boolean | null }) {
  return <div className="badge-row evidence">
    <Badge tone={installed == null ? 'unknown' : 'plain'}>{installed == null ? 'Installation unknown' : installed ? 'Installed' : 'Not installed in snapshot'}</Badge>
    <Badge tone={applicable == null ? 'unknown' : 'plain'}>{applicable == null ? 'Applicability unknown' : applicable ? 'Applicable' : 'Not applicable'}</Badge>
    <Badge tone={observed ? 'plain' : 'unknown'}>{observed ? 'Observed match' : 'Match unobserved'}</Badge>
  </div>;
}
