// Exposure surface under Network. Shows configured router listeners,
// forwarding rules and inbound permissions with their source restrictions and
// provenance. The console never scans, pings or probes: every row is labelled
// configured/observed/stale, and external reachability is never claimed.
import { Link } from 'react-router-dom';
import type { Exposure } from '../lib/contracts';
import { endpoint, text, timestamp } from '../lib/format';
import { useFilters } from '../lib/hooks';
import { Badge, Evidence, Status } from './Badge';
import { UnsupportedNotice } from './EvidenceNotices';
import { DataTable } from './DataTable';
import { Empty } from './UI';

export function ExposurePanel({ exposure, onInspect }: { exposure: Exposure; onInspect?: (ref: string) => void }) {
  const { href } = useFilters();
  const unsupported = exposure.capabilities?.find(c => c.supported === false);
  return <div className="stack" data-od-id="exposure-panel">
    <div className="notice" role="status">
      <Badge tone="plain">Configured exposure</Badge>
      <p>External reachability is never verified by this console — no scan, ping or probe is performed. Generated <time className="mono">{timestamp(exposure.generated_at)}</time>.</p>
    </div>
    {unsupported && <UnsupportedNotice detail={unsupported.reason || 'A source required for complete exposure evidence is unsupported on this image.'} />}

    <section data-od-id="exposure-listeners">
      <h2>Router listeners</h2>
      <DataTable rows={(exposure.listeners || []).map(l => ({ ...l }))} caption="Services the router is configured to listen with, with configured source restrictions. A listener without a matching inbound permission remains blocked by policy." empty="No listeners observed" columns={[
        { key: 'address', label: 'Address', sort: l => l.address, render: l => <span className="mono">{endpoint(l.address, l.port)}<span className="sub">{text(l.protocol)}</span></span> },
        { key: 'label', label: 'Configured label', sort: l => l.configured_label, render: l => <>{text(l.configured_label, 'Label unavailable')}<span className="sub">Configured label; not an inferred service name.</span></> },
        { key: 'restriction', label: 'Source restriction', sort: l => l.source_restriction, render: l => l.source_restriction ? <Badge tone="plain">{l.source_restriction}</Badge> : <Status value="Restriction unrecorded" /> },
        { key: 'state', label: 'State', sort: l => l.state, render: l => <Status value={l.state || 'unknown'} /> },
        { key: 'source', label: 'Source reference', render: l => <span className="mono">{text(l.source_ref, 'Origin unavailable')}</span> },
        { key: 'details', label: 'Details', render: l => l.observation_ref && onInspect ? <button className="btn text" onClick={() => onInspect(l.observation_ref!)} aria-label={`Inspect evidence for listener ${l.id}`}>Inspect ↗</button> : <span className="sub">{text(l.evidence, 'Evidence unavailable')}</span> },
      ]} />
    </section>

    <section data-od-id="exposure-forwards">
      <h2>Forwarding rules</h2>
      <DataTable rows={(exposure.forwards || []).map(f => ({ ...f }))} caption="Configured destination translation toward internal addresses. Configured forwarding is not observed traffic and not verified reachability." empty="No forwarding rules configured" columns={[
        { key: 'listen', label: 'Listen', sort: f => f.listen, render: f => <span className="mono">{text(f.listen)}</span> },
        { key: 'target', label: 'Target', sort: f => f.target, render: f => <span className="mono">{text(f.target)}</span> },
        { key: 'restriction', label: 'Source restriction', sort: f => f.source_restriction, render: f => f.source_restriction ? <Badge tone="plain">{f.source_restriction}</Badge> : <Status value="Unrestricted in configuration" /> },
        { key: 'state', label: 'State', sort: f => f.state, render: f => <Status value={f.state || 'unknown'} /> },
        { key: 'evidence', label: 'Evidence', render: f => <span className="sub">{text(f.evidence, 'Evidence unavailable')}</span> },
      ]} />
    </section>

    <section data-od-id="exposure-inbound">
      <h2>Inbound permissions</h2>
      <DataTable rows={(exposure.inbound || []).map((r, i) => ({ ...r, id: r.rule_id || `inbound-${i}` }))} caption="Installed inbound policy affecting router-forwarded traffic, with names and conditions preserved from the policy record. Applicability does not establish an observed match." empty="No inbound policy observed" columns={[
        { key: 'rule', label: 'Rule', sort: r => r.rule_id, render: r => r.rule_id ? <><Link className="mono" to={href('/firewall', { rule: r.rule_id })}>{r.rule_id}</Link>{r.name && <span className="sub">{r.name}</span>}</> : text(r.name, 'Rule unavailable') },
        { key: 'conditions', label: 'Conditions', sort: r => text(r.conditions, ''), render: r => r.conditions ? <span className="mono">{text(r.conditions)}</span> : 'Conditions unrecorded' },
        { key: 'action', label: 'Action', sort: r => r.action, render: r => <Status value={r.action || 'unknown'} /> },
        { key: 'scope', label: 'Scope / restriction', render: r => <>{text(r.scope, 'Scope unavailable')}{r.source_restriction && <span className="sub">{r.source_restriction}</span>}</> },
        { key: 'evidence', label: 'Evidence state', render: r => <><Evidence installed={r.installed} applicable={r.applicable} observed={r.observed_match} />{r.evidence && <span className="sub">{r.evidence}</span>}</> },
        { key: 'observed', label: 'Last observed', sort: r => r.observed_at, render: r => <time className="mono">{timestamp(r.observed_at)}</time> },
        { key: 'origin', label: 'Origin', render: r => r.origin?.producer ? <span>{r.origin.producer} · <span className="mono">{text(r.origin.revision)}</span></span> : 'Origin unavailable' },
      ]} />
    </section>

    {exposure.notes?.length ? <ul className="coverage-notes">{exposure.notes.map((note, index) => <li key={index}>{note}</li>)}</ul> : <Empty title="No exposure notes" detail="The API supplied no coverage notes for this surface." />}
  </div>;
}
