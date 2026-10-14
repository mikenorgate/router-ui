// Linked events timeline. Same reading order as the existing EventTimeline,
// extended so an event can open its underlying observation by opaque
// reference (works outside the current page) and so the server-applied
// severity/kind filters are restated beside the list.
import { Link } from 'react-router-dom';
import type { EventWithRef } from '../lib/contracts';
import { timestamp } from '../lib/format';
import { useFilters } from '../lib/hooks';
import { Status } from './Badge';
import { Empty } from './UI';

export function LinkedEventsTimeline({ events, onInspectObservation, filtersNote }: {
  events: EventWithRef[];
  onInspectObservation?: (ref: string) => void;
  filtersNote?: string;
}) {
  const { href } = useFilters();
  if (!events.length) return <Empty title="No events observed" detail="No events match the server-applied filters and window. Widening the window re-queries the router." />;
  return <div data-od-id="linked-events-timeline">
    {filtersNote && <p className="filter-note muted small">{filtersNote}</p>}
    <ol className="timeline">{events.slice(0, 200).map(event => <li key={event.id} data-od-id={`event-${event.id}`}>
      <time dateTime={event.time}>{timestamp(event.time)}</time>
      <div>
        <div className="event-heading"><strong>{event.title || event.kind || 'Recorded event'}</strong><Status value={event.severity} /></div>
        <p>{event.detail || 'Event detail unavailable'}</p>
        <div className="event-links">
          {event.device_id && <Link to={href(`/devices/${encodeURIComponent(event.device_id)}`)}>Device {event.device_id}</Link>}
          {event.rule_id && <Link to={href('/firewall', { rule: event.rule_id })}>Rule {event.rule_id}</Link>}
          {event.source_id && <Link to={href('/system', { source: event.source_id })}>Source {event.source_id}</Link>}
          {event.observation_ref && onInspectObservation && <button className="btn text" onClick={() => onInspectObservation(event.observation_ref!)} aria-label={`Inspect observation behind event ${event.id}`}>Inspect observation ↗</button>}
        </div>
      </div>
    </li>)}</ol>
    <p className="callout">Correlation and ordering do not establish cause. Each item links to the evidence behind it.</p>
  </div>;
}
