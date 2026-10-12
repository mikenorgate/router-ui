import type { Collection, Policy } from '../types';
import { query } from '../lib/api';
import { useFilters, useResource } from '../lib/hooks';
import { Inspector } from '../components/Inspector';
import { PolicyTable, RuleDetail } from '../components/PolicyTable';
import { Empty, FilterSelect, PageHeader, Panel, RequestState, SearchFilter } from '../components/UI';
export function FirewallPage() {
  const filters = useFilters();
  const resource = useResource<Collection<Policy>>(query('/policies', { device_id: filters.params.get('device_id') }));
  const q = filters.params.get('q') || '', evidence = filters.params.get('evidence') || '';
  const selected = resource.data?.items?.find(p => p.id === filters.params.get('rule'));
  const policies = (resource.data?.items || []).filter(p => JSON.stringify(p).toLowerCase().includes(q.toLowerCase()) && (!evidence || evidence === 'installed' && p.installed === true || evidence === 'applicable' && p.applicable === true || evidence === 'observed' && p.observed_match === true || evidence === 'unknown' && !p.origin?.producer));
  return <><PageHeader title="Firewall" description="Read-only installed policy, applicability, match evidence, and local provenance."><button className="btn" onClick={resource.reload}>Refresh snapshot</button></PageHeader><Panel title="Installed rule observations" description="No policy prediction or device access grant is inferred from console sign-in."><div className="filterbar"><SearchFilter value={q} onChange={value => filters.set('q', value)} label="Find a rule" hint="Rule ID, producer, revision or scope" /><FilterSelect label="Evidence" value={evidence} onChange={value => filters.set('evidence', value)} options={[["", 'All evidence'], ['installed', 'Installed'], ['applicable', 'Applicable'], ['observed', 'Observed match'], ['unknown', 'Origin unavailable']]} />{filters.params.get('device_id') && <span className="filter-chip">Device: {filters.params.get('device_id')}</span>}<button className="btn text" onClick={filters.clear}>Clear filters</button></div><RequestState resource={resource}>{() => <PolicyTable policies={policies} selected={selected?.id} onInspect={p => filters.set('rule', p.id)} />}</RequestState></Panel>{selected && <Inspector title={`Rule ${selected.id}`} onClose={() => filters.set('rule', '')}><RuleDetail policy={selected} /></Inspector>}{filters.params.has('rule') && !selected && !resource.loading && !resource.error && <Empty title="Rule not in this snapshot" detail="The API did not return the selected rule. Its prior existence does not establish current installation." action={<button className="btn" onClick={() => filters.set('rule', '')}>Close selection</button>} />}</>;
}
