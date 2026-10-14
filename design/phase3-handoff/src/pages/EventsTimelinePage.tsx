// Phase 3 Events page: one linked timeline. Severity and kind are server
// filters (sent to /api/v1/events, applied before pagination) — the returned
// page is the filtered set, and each event can open its underlying
// observation by reference.
import type { Collection } from '../types';
import type { EventWithRef } from '../lib/contracts';
import { eventsPath } from '../lib/phase3Api';
import { useFilters, useResource } from '../lib/hooks';
import { LinkedEventsTimeline } from '../components/LinkedEventsTimeline';
import { ObservationInspector } from '../components/ObservationInspector';
import { ServerFilterBar } from '../components/ServerFilterBar';
import { PageHeader, Panel, RequestState } from '../components/UI';

const eventFilters = [
  { key: 'severity', label: 'Severity', options: [['', 'All severities'], ['info', 'Info'], ['warning', 'Warning'], ['error', 'Error'], ['critical', 'Critical']] as [string, string][] },
  { key: 'kind', label: 'Kind', options: [['', 'All kinds'], ['firewall', 'Firewall'], ['policy', 'Policy'], ['address', 'Address'], ['collection', 'Collection'], ['system', 'System']] as [string, string][] },
];

export function EventsTimelinePage() {
  const filters = useFilters();
  const window_ = { range: filters.params.get('range'), from: filters.params.get('from'), to: filters.params.get('to') };
  const resource = useResource<Collection<EventWithRef>>(eventsPath({
    ...window_, q: filters.params.get('q'), device_id: filters.params.get('device_id'),
    severity: filters.params.get('severity'), kind: filters.params.get('kind'), cursor: filters.params.get('cursor'),
  }), { autoRefresh: !filters.params.has('from') });
  const observationRef = filters.params.get('observation');
  const active = [filters.params.get('severity'), filters.params.get('kind')].filter(Boolean);
  return <>
    <PageHeader title="Events" description="One linked timeline of recorded changes and observation gaps. Severity and kind are server-side filters.">
      <button className="btn" onClick={resource.reload}>Refresh events</button>
    </PageHeader>
    <Panel title="Event timeline" description="Correlation and ordering do not establish cause; each item links to the evidence behind it.">
      <ServerFilterBar searchLabel="Search events" searchHint="Device, policy, source or event" filters={eventFilters} values={filters.params} onChange={filters.set} onClear={filters.clear} />
      <RequestState resource={resource}>{data => <>
        <LinkedEventsTimeline
          events={data.items || []}
          onInspectObservation={ref => filters.set('observation', ref)}
          filtersNote={active.length ? `Server filters applied: ${active.join(', ')}. The returned page is the filtered result set.` : 'No severity or kind filter applied; the bounded page shows all kinds.'}
        />
        <div className="pagination">{filters.params.has('cursor') && <button className="btn" onClick={() => filters.set('cursor', '')}>First page</button>}{data.next_cursor && <button className="btn" onClick={() => filters.set('cursor', data.next_cursor!)}>Next event page</button>}</div>
      </>}</RequestState>
    </Panel>
    {observationRef && <ObservationInspector reference={observationRef} onClose={() => filters.set('observation', '')} />}
  </>;
}
