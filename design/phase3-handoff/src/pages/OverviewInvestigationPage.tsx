// Phase 3 Overview investigation surface: device traffic rankings and the
// interval chart (with explicit gaps) from GET /api/v1/traffic/summary, plus
// the linked recent-events excerpt. Viewer-readable summary surface; the
// observation inspector opened from a ranking row enforces its own role.
import { useNavigate } from 'react-router-dom';
import type { TrafficSummary } from '../lib/contracts';
import type { Collection, ConsoleEvent } from '../types';
import { eventsPath, trafficSummaryPath } from '../lib/phase3Api';
import { useFilters, useResource } from '../lib/hooks';
import { IntervalSummaryChart } from '../components/IntervalSummaryChart';
import { LinkedEventsTimeline } from '../components/LinkedEventsTimeline';
import { ObservationInspector } from '../components/ObservationInspector';
import { TrafficRanking } from '../components/TrafficRanking';
import { PageHeader, Panel, RequestState } from '../components/UI';

export function OverviewInvestigationPage() {
  const filters = useFilters();
  const navigate = useNavigate();
  const window_ = { range: filters.params.get('range'), from: filters.params.get('from'), to: filters.params.get('to') };
  const summary = useResource<TrafficSummary>(trafficSummaryPath(window_), { autoRefresh: !filters.params.has('from') });
  const events = useResource<Collection<ConsoleEvent>>(eventsPath({ ...window_ }), { autoRefresh: !filters.params.has('from') });
  const observationRef = filters.params.get('observation');
  return <>
    <PageHeader title="Overview" description="Ranked device traffic and aligned measurements for the selected window, with their evidence qualifiers.">
      <button className="btn" onClick={() => { summary.reload(); events.reload(); }}>Refresh observations</button>
    </PageHeader>
    <RequestState resource={summary}>{data => <div className="stack">
      <Panel title="Bandwidth and attribution timeline" description="Lanes share one time axis; gaps break the measured path. Selecting an interval carries it into Traffic." action={<button className="btn text" onClick={() => navigate(filters.href('/traffic'))}>Investigate traffic ↗</button>}>
        <IntervalSummaryChart summary={data} events={events.data?.items} from={window_.from} to={window_.to} onSelect={(from, to) => navigate(filters.href('/traffic', { from, to }))} />
      </Panel>
      <Panel title="Device traffic ranking" description="Ranked by recorded bytes in this window. Shared interface counters never appear as device totals.">
        <TrafficRanking rankings={data.rankings || []} unattributed={data.unattributed} accounting={data.accounting} onInspect={ref => filters.set('observation', ref)} />
      </Panel>
    </div>}</RequestState>
    <RequestState resource={events}>{data => <Panel title="Recent events" description="Recorded changes beside the same window; ordering is correlation, not cause." action={<button className="btn text" onClick={() => navigate(filters.href('/events'))}>All events ↗</button>}>
      <LinkedEventsTimeline events={(data.items || []).slice(0, 8)} onInspectObservation={ref => filters.set('observation', ref)} />
    </Panel>}</RequestState>
    {observationRef && <ObservationInspector reference={observationRef} onClose={() => filters.set('observation', '')} />}
  </>;
}
