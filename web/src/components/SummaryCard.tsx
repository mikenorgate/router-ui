import { Link } from 'react-router-dom';
import { count } from '../lib/format';
import { Status } from './Badge';

export type SummaryCardProps = {
  /** Stable identifier, rendered as data-od-id. */
  id: string;
  /** Card label, e.g. "Devices in inventory". */
  label: string;
  /** Recorded count; missing or unsupported values render the unobserved dash. */
  value: number | null | undefined;
  /** Navigation target for investigating the evidence behind the count. */
  to: string;
  /** Muted qualifier describing what the count covers; include ↗ when it navigates. */
  hint: string;
  /** True when no producer supports this measurement; shows an unsupported badge instead of a value. */
  unsupported?: boolean;
};

/** Navigation summary rendered with the same structure and styles as a Metric card. */
export function SummaryCard({ id, label, value, to, hint, unsupported = false }: SummaryCardProps) {
  const observed = !unsupported && typeof value === 'number' && Number.isFinite(value);
  return <Link className="metric summary-metric" to={to} data-od-id={id}>
    <dl>
      <dt>{label}</dt>
      <dd><span className="value">{observed ? count(value) : '—'}</span></dd>
    </dl>
    <div className="meta">
      {unsupported ? <Status value="Unsupported" /> : null}
      <span className="hint">{hint}</span>
    </div>
  </Link>;
}
