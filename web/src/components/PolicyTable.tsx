import type { Policy } from '../types';
import { bytes, expired, number, text, timestamp } from '../lib/format';
import { Badge, Evidence, Status } from './Badge';
import { DataTable } from './DataTable';
import { Fields } from './UI';
export function counterLabel(policy: Policy): string { return policy.counters_scope === 'shared' ? 'Shared rule counter' : policy.counters_scope === 'device' ? 'Device-attributed counter' : 'Counter attribution unknown'; }
export function PolicyTable({ policies, onInspect, selected }: { policies: Policy[]; onInspect: (policy: Policy) => void; selected?: string | null }) {
  return <DataTable rows={policies} selected={selected} caption="Installed, applicable and observed match are separate claims. Scope and observation time qualify each rule." columns={[
    { key: 'rule', label: 'Rule / source', sort: p => p.id, render: p => <><strong className="mono">{p.id}</strong><span className="sub">{p.name || 'Rule name unavailable'}</span><span className="sub">{p.origin?.producer || 'Origin unavailable'} · {p.origin?.revision || 'Revision unavailable'}</span></> },
    { key: 'scope', label: 'Action / scope', sort: p => p.action, render: p => <><Status value={p.action} /><span className="sub">{p.scope || 'Scope unavailable'}</span></> },
    { key: 'evidence', label: 'Evidence', render: p => <><Evidence installed={p.installed} applicable={p.applicable} observed={p.observed_match} />{expired(p.expires_at) && <Badge tone="warn">Expiry passed · removal unconfirmed</Badge>}</> },
    { key: 'counters', label: 'Counters / observation', sort: p => p.packets, render: p => <>{counterLabel(p)}<span className="sub mono">{number(p.packets)} packets · {bytes(p.bytes)}</span><span className="sub mono">{timestamp(p.observed_at)}</span></> },
    { key: 'inspect', label: 'Details', render: p => <button className="btn text" onClick={() => onInspect(p)} aria-label={`Inspect rule ${p.id}`}>Inspect ↗</button> },
  ]} />;
}
export function RuleDetail({ policy: p }: { policy: Policy }) {
  return <div className="stack"><Evidence installed={p.installed} applicable={p.applicable} observed={p.observed_match} /><Fields items={[
    ['Rule', <span className="mono">{p.id}</span>], ['Action', <Status value={p.action} />], ['Conditions', text(p.conditions)], ['Scope', p.scope],
    ['Table / chain', <span className="mono">{p.table || 'Unknown'} / {p.chain || 'Unknown'}</span>], ['Recorded hook', p.hook || 'Hook path unavailable'], ['Priority / order', <span className="mono">{number(p.priority)} / {number(p.order)}</span>],
    ['Observed snapshot', <time className="mono">{timestamp(p.observed_at)}</time>], ['Expiry', p.expires_at ? timestamp(p.expires_at) : 'No expiry recorded'], ['Counters', `${counterLabel(p)} · ${number(p.packets)} packets · ${bytes(p.bytes)}`],
  ]} /><h3>Policy provenance</h3><ol className="chain">
    <li><p>{p.origin?.producer || 'Origin unavailable'}</p><small>Producer · {p.origin?.source_ref || 'Source reference unavailable'}</small></li>
    <li><p className="mono">{p.origin?.policy_id || 'Logical policy ID unavailable'}</p><small>Revision · {p.origin?.revision || 'Unavailable'}</small></li>
    <li><p>{p.origin?.group_id || 'Group not recorded'}</p><small>{p.scope || 'Inherited scope unavailable'}</small></li>
    <li><p className="mono">{p.id}</p><small>{p.installed === true ? 'Installed in recorded snapshot' : p.installed === false ? 'Not installed in recorded snapshot' : 'Installation unknown'} · {timestamp(p.observed_at)}</small></li>
  </ol><p className="callout">{expired(p.expires_at) ? 'The recorded expiry has passed. Expiry alone does not prove removal; a later snapshot is required.' : 'Applicability does not prove a match. A firewall decision does not establish application connectivity.'}</p></div>;
}
