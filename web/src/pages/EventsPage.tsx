import type { Collection, ConsoleEvent } from '../types';
import { query } from '../lib/api';
import { filterEvents } from '../lib/filters';
import { useFilters, useResource } from '../lib/hooks';
import { EventTimeline } from '../components/EventTimeline';
import { FilterSelect, PageHeader, Panel, RequestState, SearchFilter } from '../components/UI';
export function EventsPage() {
  const filters = useFilters();
  const q = filters.params.get('q') || '';
  const resource = useResource<Collection<ConsoleEvent>>(query('/events', { q, device_id: filters.params.get('device_id'), cursor: filters.params.get('cursor'), range: filters.params.get('range'), from: filters.params.get('from'), to: filters.params.get('to') }));
  return <><PageHeader title="Events" description="A linked timeline of recorded changes and observation gaps."><button className="btn" onClick={resource.reload}>Refresh events</button></PageHeader><Panel title="Event timeline" description="Correlation and event ordering do not establish cause. Time filters apply to the returned page."><div className="filterbar"><SearchFilter value={q} onChange={value => filters.set('q', value)} hint="Device, policy, source or event" /><FilterSelect label="Severity" value={filters.params.get('severity') || ''} onChange={value => filters.set('severity', value)} options={[["", 'All severities'], ['info', 'Info'], ['warning', 'Warning'], ['error', 'Error'], ['critical', 'Critical']]} /><FilterSelect label="Kind" value={filters.params.get('kind') || ''} onChange={value => filters.set('kind', value)} options={[["", 'All kinds'], ['firewall', 'Firewall'], ['policy', 'Policy'], ['address', 'Address'], ['collection', 'Collection'], ['system', 'System']]} /><button className="btn text" onClick={filters.clear}>Clear filters</button></div><RequestState resource={resource}>{data => <><EventTimeline events={filterEvents(data.items || [], filters.params)} /><div className="pagination">{filters.params.has('cursor') && <button className="btn" onClick={() => filters.set('cursor', '')}>First page</button>}{data.next_cursor && <button className="btn" onClick={() => filters.set('cursor', data.next_cursor!)}>Next event page</button>}</div></>}</RequestState></Panel></>;
}
