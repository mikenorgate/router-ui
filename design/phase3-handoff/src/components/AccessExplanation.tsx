// Passive access explanation. The observed decision, the predicted outcome,
// and application connectivity are three separate claims and are rendered
// separately. Policy path ordering, provenance, binding validity and
// translation evidence stay visible; what the evidence cannot answer is
// listed as unresolved questions rather than smoothed over.
import { Link } from 'react-router-dom';
import type { AccessInvestigation } from '../lib/contracts';
import { endpoint, timestamp, text } from '../lib/format';
import { useFilters } from '../lib/hooks';
import { Badge, Evidence, Status } from './Badge';
import { Fields } from './UI';

export function AccessExplanation({ investigation }: { investigation: AccessInvestigation }) {
  const { href } = useFilters();
  const inv = investigation;
  const decision = inv.observed_decision;
  return <div className="stack" data-od-id="access-explanation">
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
        : <p><Badge tone="unknown">No observed decision</Badge> <span className="muted">The router recorded no verdict for this tuple. Any outcome below is predicted, not observed.</span></p>}
      {inv.predicted_outcome && <p data-od-id="predicted-outcome"><Badge tone="warn">Simulated outcome</Badge> <span>{inv.predicted_outcome.result}</span> <span className="muted">{inv.predicted_outcome.basis}</span></p>}
      <p className="callout">An observed or predicted verdict does not establish application connectivity; a recorded conntrack entry alone does not prove success either.</p>
    </section>

    <section data-od-id="explanation-policy-path">
      <h2>Policy path</h2>
      <p className="muted">Evaluation order and hook context preserved; this is not flattened into a single first-match list.</p>
      {inv.policy_path?.length ? <ol className="policy-path">{inv.policy_path.map((step, index) => <li key={index} data-od-id={`policy-step-${step.rule_id || index}`}>
        <div className="event-heading"><strong>{step.step}</strong>{step.action && <Status value={step.action} />}</div>
        <Evidence installed={step.installed} applicable={step.applicable} observed={step.observed_match} />
        <Fields items={[
          ['Rule', step.rule_id ? <Link className="mono" to={href('/firewall', { rule: step.rule_id })}>{step.rule_id}</Link> : 'Rule unavailable'],
          ['Scope', step.scope || 'Scope unavailable'],
          ['Hook / order', <span className="mono">{text(step.hook, 'Hook unavailable')} · {step.order == null ? 'order unavailable' : step.order}</span>],
          ['Origin', step.origin?.producer
            ? <span>{step.origin.producer} · <span className="mono">{text(step.origin.policy_id)} · {text(step.origin.revision)} · {text(step.origin.source_ref)}</span></span>
            : 'Origin unavailable'],
          ['Counters', step.counters_scope === 'shared' ? 'Shared rule counter' : step.counters_scope === 'device' ? 'Per-device counter' : 'Counter scope unknown'],
          ['Last observed in policy', <time className="mono">{timestamp(step.observed_at)}</time>],
        ]} />
      </li>)}</ol> : <p className="callout">No policy path evidence is available for this subject.</p>}
    </section>

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
