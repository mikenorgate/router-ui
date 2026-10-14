// Ranked device traffic for the selected window. Shares are of attributed
// traffic only; the unattributed bucket stays visible and is never reassigned.
import { Link } from 'react-router-dom';
import type { AccountingKind, DeviceTrafficRank } from '../lib/contracts';
import { bytes, number } from '../lib/format';
import { useFilters } from '../lib/hooks';
import { Status } from './Badge';
import { DataTable } from './DataTable';
import { Empty } from './UI';

interface RankRow {
  id: string;
  rank: number | null;
  device_id?: string;
  label?: string;
  sent?: number | null;
  received?: number | null;
  share?: number | null;
  evidence?: string;
  observation_ref?: string;
  unattributed?: boolean;
}

export function TrafficRanking({ rankings, unattributed, accounting, onInspect }: {
  rankings: DeviceTrafficRank[];
  unattributed?: { bytes_sent?: number | null; bytes_received?: number | null; note?: string };
  accounting: AccountingKind;
  onInspect?: (ref: string) => void;
}) {
  const { href } = useFilters();
  const rows: RankRow[] = rankings.slice(0, 20).map((r, i) => ({
    id: r.device_id, rank: i + 1, device_id: r.device_id, label: r.label,
    sent: r.bytes_sent, received: r.bytes_received, share: r.share_of_attributed,
    evidence: r.evidence, observation_ref: r.observation_ref,
  }));
  if (unattributed) rows.push({ id: 'unattributed', rank: null, label: 'Unattributed bucket', sent: unattributed.bytes_sent, received: unattributed.bytes_received, evidence: 'unknown', unattributed: true });
  if (!rows.length) return <Empty title="No attributed traffic in this window" detail="Rankings require observations with bindings valid at the time. Missing measurements are not zero traffic." />;
  return <DataTable rows={rows} caption={`Device traffic ranking · ${accounting === 'live-interval' ? 'live interval accounting' : 'completed-flow totals'}. Shares cover attributed traffic only and never the interface total.`} columns={[
    { key: 'rank', label: 'Rank', sort: r => r.rank ?? Number.MAX_SAFE_INTEGER, render: r => <span className="mono">{r.rank ?? '—'}</span> },
    { key: 'device', label: 'Device', sort: r => r.label || r.device_id || '', render: r => r.device_id
      ? <><Link to={href(`/devices/${encodeURIComponent(r.device_id)}`)}>{r.label || r.device_id}</Link><span className="sub mono">{r.device_id}</span></>
      : <><strong>{r.label}</strong>{r.unattributed && <span className="sub">{unattributed?.note || 'No binding valid at observation time.'}</span>}</> },
    { key: 'sent', label: 'Sent', sort: r => r.sent, render: r => <span className="mono cell-num">{bytes(r.sent)}</span> },
    { key: 'received', label: 'Received', sort: r => r.received, render: r => <span className="mono cell-num">{bytes(r.received)}</span> },
    { key: 'share', label: 'Share of attributed', sort: r => r.share, render: r => <span className="mono cell-num">{r.share == null ? 'Unavailable' : `${number(r.share * 100)}%`}</span> },
    { key: 'evidence', label: 'Evidence', sort: r => r.evidence, render: r => <><Status value={r.evidence || 'unknown'} />{r.observation_ref && onInspect && <button className="btn text" onClick={() => onInspect(r.observation_ref!)} aria-label={`Inspect top observation for ${r.device_id}`}>Inspect ↗</button>}</> },
  ]} />;
}
