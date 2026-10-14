// Passive access explanation. The observed decision and application
// connectivity are separate claims and are rendered separately. Outcomes are
// never simulated: when no decision was observed, none is inferred. Policy
// evidence is the recorded policy context — the backend may retain only one
// historical rule for a subject, hook/order values are recorded rule
// attributes, and no evaluation order is reconstructed or simulated.
import { Link } from 'react-router-dom';
import type { AccessInvestigation } from '../lib/contracts';
import { endpoint, timestamp, text } from '../lib/format';
import { useFilters } from '../lib/hooks';
import { Badge, Evidence, Status } from './Badge';
import { LinkedEventsTimeline } from './LinkedEventsTimeline';
import { Fields } from './UI';

export function AccessExplanation({ investigation }: { investigation: AccessInvestigation }) {
  const { href, set } = useFilters();
  const inv = investigation;
  const identity = inv.identity;
  const decision = inv.observed_decision;
  return <div className="stack" data-od-id="access-explanation">
    {identity && <section data-od-id="explanation-identity">
      <h2>Investigation record</h2>
      <Fields items={[
        ['Observation source', <span className="mono">{identity.source_kind || 'Kind unavailable'} · {identity.source_id}</span>],
        ['Router boot', <span className="mono">{identity.boot_id || 'Boot identity unavailable'}</span>],
        ['Producer record', <span className="mono">{identity.record_id || 'Record identity unavailable'}</span>],
        ['Recorded at', <time className="mono">{timestamp(identity.recorded_at)}</time>],
      ]} />
    </section>}
    <section data-od-id="explanation-subject">
      <h2>Subject</h2>
      <Fields items={[
        ['Tuple', <span className="mono">{text(inv.subject.source)} → {endpoint(inv.subject.destination, inv.subject.destination_port)} · {inv.subject.protocol || 'Protocol unavailable'}</span>],
        ['Device', inv.subject.device_id ? <Link to={href(`/devices/${encodeURIComponent(inv.subject.device_id)}`)}>{inv.subject.device_id}</Link> : 'Device association unavailable'],
        ['Explanation produced', <time className="mono">{timestamp(inv.subject.queried_at)}</time>],
      ]} />
    </section>

    <section data-od-id="explanation-decision">
      <h2>Observed decision</h2>
      {decision
        ? <><p><Status value={decision.verdict || 'unknown'} /> <span className="muted">observed <time className="mono">{timestamp(decision.observed_at)}</time></span></p>
            <p className="callout">{decision.evidence || 'Decision evidence unavailable.'}</p></>
        : <p><Badge tone="unknown">No observed decision</Badge> <span className="muted">The router recorded no verdict for this tuple. No outcome is inferred.</span></p>}
      <p className="callout">An observed verdict does not establish application connectivity; a recorded conntrack entry alone does not prove success either.</p>
    </section>

    <section data-od-id="explanation-policy-context">
      <h2>Recorded policy context</h2>
      <p className="muted">Policy evidence retained for this subject. The record may contain only one historically retained rule; hook and order values are recorded rule attributes, not a reconstructed evaluation path, and no evaluation order is inferred.</p>
      {inv.policy_path?.length ? <ul className="policy-path">{inv.policy_path.map((step, index) => <li key={index} data-od-id={`policy-step-${step.rule_id || index}`}>
        <div className="event-heading"><strong>{step.step}</strong>{step.action && <Status value={step.action} />}</div>
        <Evidence installed={step.installed} applicable={step.applicable} observed={step.observed_match} />
        <Fields items={[
          ['Rule', step.rule_id ? <Link className="mono" to={href('/firewall', { rule: step.rule_id })}>{step.rule_id}</Link> : 'Rule unavailable'],
          ['Scope', step.scope || 'Scope unavailable'],
          ['Recorded hook / order', <span className="mono">{text(step.hook, 'Hook unrecorded')} · {step.order == null ? 'order unrecorded' : step.order}</span>],
          ['Origin', step.origin?.producer
            ? <span>{step.origin.producer} · <span className="mono">{text(step.origin.policy_id)} · {text(step.origin.revision)} · {text(step.origin.source_ref)}</span></span>
            : 'Origin unavailable'],
          ['Counters', step.counters_scope === 'shared' ? 'Shared rule counter' : step.counters_scope === 'device' ? 'Per-device counter' : 'Counter scope unknown'],
          ['Last observed in policy', <time className="mono">{timestamp(step.observed_at)}</time>],
        ]} />
      </li>)}</ul> : <p className="callout">No retained policy evidence is available for this subject.</p>}
    </section>

    {inv.events?.length ? <section data-od-id="explanation-events">
      <h2>Related events</h2>
      <p className="muted">Events the backend correlated with this subject. Correlation and ordering do not establish cause.</p>
      <LinkedEventsTimeline events={inv.events} onInspectObservation={ref => set('observation', ref)} />
    </section> : null}

    <section data-od-id="explanation-binding">
      <h2>Address binding at observation time</h2>
      {inv.binding
        ? <><Fields items={[
            ['Address', <span className="mono">{text(inv.binding.address)}</span>],
            ['Device', inv.binding.device_id ? <Link to={href(`/devices/${encodeURIComponent(inv.binding.device_id)}`, { tab: 'addresses' })}>{inv.binding.device_id}</Link> : 'Unavailable'],
            ['Valid from / until', <span className="mono">{timestamp(inv.binding.valid_from)} / {inv.binding.valid_until ? timestamp(inv.binding.valid_until) : 'End not recorded'}</span>],
            ['Association source', inv.binding.source || 'Source unavailable'],
            ['Confidence', inv.binding.confidence || 'Confidence unavailable'],
          ]} /><p className="callout">Historical traffic is attributed with bindings valid at the time of the event; a current lease does not rewrite history.</p></>
        : <p className="callout">No binding was valid at the observation time; the device association is unresolved.</p>}
    </section>

    <section data-od-id="explanation-translation">
      <h2>Translation evidence</h2>
      {inv.translation?.recorded
        ? <Fields items={[
            ['Original tuple', <span className="mono">{endpoint(inv.translation.original?.source_ip, inv.translation.original?.source_port)} → {endpoint(inv.translation.original?.destination_ip, inv.translation.original?.destination_port)}</span>],
            ['Translated tuple', inv.translation.translated
              ? <span className="mono">{endpoint(inv.translation.translated.source_ip, inv.translation.translated.source_port)} → {endpoint(inv.translation.translated.destination_ip, inv.translation.translated.destination_port)}</span>
              : 'Translated tuple unavailable in this contract'],
            ['Note', inv.translation.note || 'None'],
          ]} />
        : <p className="callout">{inv.translation?.note || 'No translation recorded; none is inferred.'}</p>}
    </section>

    {inv.route && <section data-od-id="explanation-route">
      <h2>Route evidence</h2>
      <Fields items={[
        ['Egress interface', inv.route.interface || 'Unavailable'],
        ['Next hop', <span className="mono">{inv.route.next_hop || 'Unavailable'}</span>],
        ['Evidence', inv.route.evidence || 'Route evidence unavailable'],
      ]} />
    </section>}

    <section data-od-id="explanation-unresolved">
      <h2>Unresolved questions</h2>
      {inv.unresolved_questions?.length
        ? <ul className="unresolved-list">{inv.unresolved_questions.map((question, index) => <li key={index}><span aria-hidden="true">? </span>{question}</li>)}</ul>
        : <p className="callout">No unresolved questions were recorded; treat this as a claim about this explanation, not about the network.</p>}
    </section>

    {inv.limits?.length ? <section data-od-id="explanation-limits">
      <h2>Limits of this explanation</h2>
      <ul className="coverage-notes">{inv.limits.map((limit, index) => <li key={index}>{limit}</li>)}</ul>
    </section> : null}
  </div>;
}
