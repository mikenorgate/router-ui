import type { Collection, Policy } from '../types';
import { useFilters, useResource } from '../lib/hooks';
import { policiesPath, usePolicyPages } from '../lib/policies';
import { Inspector } from '../components/Inspector';
import { RuleDetail } from '../components/PolicyTable';
import { PoliciesPanel } from '../components/PoliciesPanel';
import { Empty, FilterSelect, PageHeader, SearchFilter } from '../components/UI';
export function FirewallPage() {
  const filters = useFilters();
  const deviceId = filters.params.get('device_id') || '';
  const q = filters.params.get('q') || '';
  const evidence = filters.params.get('evidence') || '';
  const resource = useResource<Collection<Policy>>(policiesPath({ deviceId: deviceId || undefined, q, evidence }), { autoRefresh: true });
  const pages = usePolicyPages(resource, { deviceId: deviceId || undefined, q, evidence });
  const selected = pages.policies.find(p => p.id === filters.params.get('rule'));
  return <><PageHeader title="Firewall" description="Read-only installed policy, applicability, match evidence, and local provenance."><button className="btn" onClick={resource.reload}>Refresh snapshot</button></PageHeader><PoliciesPanel
    title="Installed rule observations"
    description="No policy prediction or device access grant is inferred from console sign-in."
    pages={pages}
    selectedRule={selected?.id}
    onInspect={p => filters.set('rule', p.id)}
    pageResetKey={`${deviceId}|${q}|${evidence}`}
    filters={<div className="filterbar"><SearchFilter value={q} onChange={value => filters.set('q', value)} label="Find a rule" hint="Rule ID, producer, revision or scope" /><FilterSelect label="Evidence" value={evidence} onChange={value => filters.set('evidence', value)} options={[["", 'All evidence'], ['installed', 'Installed'], ['applicable', 'Applicable'], ['observed', 'Observed match'], ['unknown', 'Origin unavailable']]} />{deviceId && <span className="filter-chip">Device: {deviceId}</span>}<button className="btn text" onClick={filters.clear}>Clear filters</button></div>}
  />{selected && <Inspector title={`Rule ${selected.id}`} onClose={() => filters.set('rule', '')}><RuleDetail policy={selected} /></Inspector>}{filters.params.has('rule') && !selected && !resource.loading && !resource.error && <Empty title="Rule not in this snapshot" detail="The API did not return the selected rule. Its prior existence does not establish current installation." action={<button className="btn" onClick={() => filters.set('rule', '')}>Close selection</button>} />}</>;
}
