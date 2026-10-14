import type { Source } from '../types';
import { age, number, sampling, timestamp } from '../lib/format';
import { Status } from './Badge';
import { Empty } from './UI';

function known(value?: string | null): value is string {
  return !!value && Number.isFinite(Date.parse(value));
}

function meta(source: Source): string[] {
  const parts: string[] = [];
  if (source.generation !== null && source.generation !== undefined && source.generation !== '') parts.push(`gen ${source.generation}`);
  if (source.scope) parts.push(source.scope);
  if (source.sampling_rate != null) parts.push(sampling(source.sampling_rate));
  if (source.lost_records != null) parts.push(`${number(source.lost_records)} lost`);
  if (source.sequence_gaps != null) parts.push(`${number(source.sequence_gaps)} gaps`);
  if (known(source.checked_at)) parts.push(`checked ${timestamp(source.checked_at)}`);
  return parts;
}

export function SourceCards({ sources }: { sources: Source[] }) {
  if (!sources.length) return <Empty title="No sources reported" detail="The API did not supply observation sources for this view." />;
  return <ul className="source-cards" aria-label="Collection evidence by source">
    {sources.map(source => {
      const observed = known(source.observed_at) ? timestamp(source.observed_at) : null;
      const when = age(source.lag_seconds);
      const details = meta(source);
      return <li key={source.id}>
        <article className="source-card" data-od-id={`source-card-${source.id}`}>
          <div className="source-card-head">
            <div><strong>{source.kind || source.id}</strong><span className="source-card-id mono">{source.id}</span></div>
            <Status value={source.status} />
          </div>
          {source.error_code && <p className="error-text">{source.error_code}</p>}
          <p className="source-card-obs">
            {observed ? <>Observed{when ? ` ${when} · ` : ' '}<time className="mono">{observed}</time></> : 'No observations recorded'}
          </p>
          <p className="source-card-coverage">{source.coverage || 'Coverage unavailable'}</p>
          {details.length > 0 && <p className="source-card-meta mono">{details.join(' · ')}</p>}
        </article>
      </li>;
    })}
  </ul>;
}
