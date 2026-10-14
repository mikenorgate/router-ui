import type { Source } from '../types';
import { number, sampling, timestamp } from '../lib/format';
import { Status } from './Badge';
import { DataTable } from './DataTable';
export function SourceTable({ sources }: { sources: Source[] }) {
  return <DataTable rows={sources} caption="Source freshness is independent of page refresh. Missing loss counts and sequence numbers remain unavailable." columns={[
    { key: 'source', label: 'Source', sort: s => s.kind || s.id, render: s => <><strong>{s.kind || s.id}</strong><span className="sub mono">{s.id}</span></> },
    { key: 'status', label: 'Evidence', sort: s => s.status, render: s => <><Status value={s.status} />{s.error_code && <span className="sub" style={{ color: 'var(--danger)' }}>{s.error_code}</span>}<span className="sub">{sampling(s.sampling_rate)}</span></> },
    { key: 'age', label: 'Observation time', sort: s => s.observed_at, render: s => <><time className="mono">{timestamp(s.observed_at)}</time>{s.checked_at && <span className="sub mono">Checked: {timestamp(s.checked_at)}</span>}<span className="sub mono">Lag: {number(s.lag_seconds)} s</span></> },
    { key: 'context', label: 'Scope & Generation', render: s => <><span className="mono">Gen: {s.generation ?? 'unknown'}</span><span className="sub mono">Scope: {s.scope || 'unknown'}</span></> },
    { key: 'coverage', label: 'Coverage and gaps', render: s => <>{s.coverage || 'Coverage unavailable'}<span className="sub mono">Lost records: {number(s.lost_records)} · missing batches: {number(s.sequence_gaps)} · sequence: {number(s.last_sequence)}</span></> },
  ]} />;
}
