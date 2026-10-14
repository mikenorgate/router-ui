import type { Policy } from '../types';
import { bytes, expired, number, text, timestamp } from '../lib/format';
import { producerLabel } from '../lib/policies';
import { Badge, Evidence, Status } from './Badge';
import { DataTable } from './DataTable';
import { Fields } from './UI';
/** Client page size for loaded policy rows; matches the server page size so each fetched page is one client page. */
export const POLICY_CLIENT_PAGE_SIZE = 100;
export function counterLabel(policy: Policy): string { return policy.counters_scope === 'shared' ? 'Shared rule counter' : policy.counters_scope === 'device' ? 'Device-attributed counter' : 'Counter attribution unknown'; }
export function PolicyTable({ policies, onInspect, selected, pageResetKey }: { policies: Policy[]; onInspect: (policy: Policy) => void; selected?: string | null; pageResetKey?: string }) {
  return <DataTable rows={policies} selected={selected} paginate pageSize={POLICY_CLIENT_PAGE_SIZE} pageResetKey={pageResetKey} caption="Installed, applicable and observed match are separate claims. Scope and observation time qualify each rule." columns={[
    { key: 'rule', label: 'Rule / Application', sort: p => p.rule_id || p.id, render: p => <><strong className="mono">{p.rule_id || p.id}</strong><span className="sub">{p.name || 'Rule name unavailable'}</span><span className="sub">{p.application_id ? `App: ${p.application_id}` : producerLabel(p.origin?.producer)}</span></> },
    { key: 'scope', label: 'Action / scope', sort: p => p.action, render: p => <><Status value={p.action} /><span className="sub">{p.scope || 'Scope unavailable'}</span></> },
    { key: 'evidence', label: 'Evidence / Lifecycle', render: p => <><Evidence installed={p.installed} applicable={p.applicable} observed={p.observed_match} />{p.lifecycle && <Badge tone={p.lifecycle === 'confirmed_removed' ? 'plain' : p.lifecycle === 'active' ? 'good' : 'warn'}>{p.lifecycle.replace(/_/g, ' ')}</Badge>}{(p.lifecycle !== 'expired_pending_removal' && expired(p.expires_at)) && <Badge tone="warn">Expiry passed · removal unconfirmed</Badge>}</> },
    { key: 'counters', label: 'Counters / observation', sort: p => p.packets, render: p => <>{counterLabel(p)}<span className="sub mono">{number(p.packets)} packets · {bytes(p.bytes)}</span><span className="sub mono">{timestamp(p.observed_at)}</span></> },
    { key: 'inspect', label: 'Details', render: p => <button className="btn text" onClick={() => onInspect(p)} aria-label={`Inspect rule ${p.id}`}>Inspect ↗</button> },
  ]} />;
}
export function RuleDetail({ policy: p }: { policy: Policy }) {
  return <div className="stack"><Evidence installed={p.installed} applicable={p.applicable} observed={p.observed_match} /><Fields items={[
    ['Rule ID', <span className="mono">{p.rule_id || p.id}</span>], ['Application ID', p.application_id ? <span className="mono">{p.application_id}</span> : 'Global rule definition'], ['Action', <Status value={p.action} />], ['Conditions', text(p.conditions)], ['Scope', p.scope],
    ['Binding evidence', p.binding_ref ? <span className="mono">{p.binding_ref}</span> : 'No binding recorded'], ['Installation gen', p.installation_generation ? <span className="mono">{p.installation_generation}</span> : 'Unknown'],
    ['Lifecycle', p.lifecycle ? <span className="mono">{p.lifecycle.replace(/_/g, ' ')} {p.lifecycle_at ? `at ${timestamp(p.lifecycle_at)}` : ''}</span> : 'Lifecycle unknown'],
    ['Table / chain', <span className="mono">{p.table || 'Unknown'} / {p.chain || 'Unknown'}</span>], ['Recorded hook', p.hook || 'Hook path unavailable'], ['Priority / order', <span className="mono">{number(p.priority)} / {number(p.order)}</span>],
    ['Observed snapshot', <time className="mono">{timestamp(p.observed_at)}</time>], ['Expiry', p.expires_at ? timestamp(p.expires_at) : 'No expiry recorded'], ['Counters', `${counterLabel(p)} · ${number(p.packets)} packets · ${bytes(p.bytes)}`],
  ]} /><h3>Policy provenance</h3><ol className="chain">
    <li><p>{producerLabel(p.origin?.producer)}</p><small>Producer · {p.origin?.source_ref || 'Source reference unavailable'}</small></li>
    <li><p className="mono">{p.origin?.policy_id || 'Logical policy ID unavailable'}</p><small>Revision · {p.origin?.revision || 'Unavailable'}</small></li>
    <li><p>{p.origin?.group_id || 'Group not recorded'}</p><small>{p.scope || 'Inherited scope unavailable'}</small></li>
    <li><p className="mono">{p.id}</p><small>{p.installed === true ? 'Installed in recorded snapshot' : p.installed === false ? 'Not installed in recorded snapshot' : 'Installation unknown'} · {timestamp(p.observed_at)}</small></li>
  </ol><p className="callout">{p.lifecycle === 'expired_pending_removal' ? 'Removal pending confirmation in a later snapshot.' : expired(p.expires_at) ? 'The recorded expiry has passed. Expiry alone does not prove removal; a later snapshot is required.' : 'Applicability does not prove a match. A firewall decision does not establish application connectivity.'}</p></div>;
}
