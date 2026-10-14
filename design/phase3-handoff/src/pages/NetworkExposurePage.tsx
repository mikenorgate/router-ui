// Phase 3 Network → Exposure: configured router listeners, forwarding rules
// and inbound permissions with source restrictions, provenance and explicit
// uncertainty. Passive only — the console performs no scan, ping or probe.
import type { Exposure } from '../lib/contracts';
import { exposurePath } from '../lib/phase3Api';
import { useFilters, useResource } from '../lib/hooks';
import { ExposurePanel } from '../components/ExposurePanel';
import { ObservationInspector } from '../components/ObservationInspector';
import { PageHeader, Panel, RequestState } from '../components/UI';

export function NetworkExposurePage() {
  const filters = useFilters();
  const resource = useResource<Exposure>(exposurePath(), { autoRefresh: false });
  const observationRef = filters.params.get('observation');
  return <>
    <PageHeader title="Exposure" description="Configured listeners, forwarding and inbound permissions. Configured exposure is never externally verified reachability." parent="Network">
      <button className="btn" onClick={resource.reload}>Refresh observations</button>
    </PageHeader>
    <RequestState resource={resource}>{data => <Panel title="Configured exposure" description="From installed policy and image manifests; observation times and uncertainty are shown per row.">
      <ExposurePanel exposure={data} onInspect={ref => filters.set('observation', ref)} />
    </Panel>}</RequestState>
    {observationRef && <ObservationInspector reference={observationRef} onClose={() => filters.set('observation', '')} />}
  </>;
}
