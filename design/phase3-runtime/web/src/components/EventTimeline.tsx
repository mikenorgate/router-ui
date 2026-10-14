import { Link } from 'react-router-dom';
import type { ConsoleEvent } from '../types';
import { timestamp } from '../lib/format';
import { useFilters } from '../lib/hooks';
import { Status } from './Badge';
import { Empty } from './UI';
export function EventTimeline({ events }: { events: ConsoleEvent[] }) {
  const { href } = useFilters();
  if (!events.length) return <Empty title="No events observed" detail="No matching events are available in the bounded response." />;
  return <ol className="timeline" data-od-id="event-timeline">{events.slice(0, 200).map(event => <li key={event.id} data-od-id={`event-${event.id}`}><time dateTime={event.time}>{timestamp(event.time)}</time><div><div className="event-heading"><strong>{event.title || event.kind || 'Recorded event'}</strong><Status value={event.severity} /></div><p>{event.detail || 'Event detail unavailable'}</p><div className="event-links">{event.device_id && <Link to={href(`/devices/${encodeURIComponent(event.device_id)}`)}>Device {event.device_id}</Link>}{event.rule_id && <Link to={href('/firewall', { rule: event.rule_id })}>Rule {event.rule_id}</Link>}{event.source_id && <Link to={href('/system', { source: event.source_id })}>Source {event.source_id}</Link>}</div></div></li>)}</ol>;
}
