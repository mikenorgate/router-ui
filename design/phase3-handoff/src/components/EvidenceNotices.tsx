// Evidence-state notices for Phase 3 surfaces. Each state is a designed,
// labelled condition — never implied by absence of content, never colour-only.
// Composes the existing Badge tones and notice/empty styles from styles.css.
import type { ReactNode } from 'react';
import { sampling, timestamp } from '../lib/format';
import { Badge } from './Badge';
import { Permission } from './UI';

/** Observation time is older than the source's expected freshness. */
export function StaleNotice({ observedAt, detail }: { observedAt?: string | null; detail?: string }) {
  return <div className="notice" data-od-id="stale-notice" role="status">
    <Badge tone="warn">Stale evidence</Badge>
    <p>{detail || 'This observation may not describe the current state.'} Last observed <time className="mono">{timestamp(observedAt)}</time>.</p>
  </div>;
}

/** Only part of the requested evidence is available. */
export function PartialNotice({ detail }: { detail: string }) {
  return <div className="notice" data-od-id="partial-notice" role="status">
    <Badge tone="warn">Partial evidence</Badge><p>{detail}</p>
  </div>;
}

/** The router has no supported source for this measurement. */
export function UnsupportedNotice({ detail }: { detail: string }) {
  return <div className="notice" data-od-id="unsupported-notice" role="status">
    <Badge tone="unknown">Unsupported</Badge><p>{detail}</p>
  </div>;
}

/** The bounded result was truncated; totals shown describe the returned page. */
export function OverflowNotice({ shown, limit, action }: { shown: number; limit: number; action?: ReactNode }) {
  return <div className="notice" data-od-id="overflow-notice" role="status">
    <Badge tone="plain">Bounded result</Badge>
    <p>Showing {shown} of a {limit}-record bounded page. Refine filters or follow the cursor for more; this page is not a total.</p>
    {action}
  </div>;
}

/** Distinguishes collection sampling from retention sampling, side by side. */
export function SamplingNotice({ sourceRate, storageRate, note }: { sourceRate?: number | null; storageRate?: number | null; note?: string }) {
  return <div className="notice" data-od-id="sampling-notice" role="status">
    <Badge tone="warn">Sampled evidence</Badge>
    <p>Source sampling: <span className="mono">{sampling(sourceRate)}</span> · storage sampling: <span className="mono">{sampling(storageRate)}</span>.{note ? ` ${note}` : ''} Missing measurements are not zero traffic.</p>
  </div>;
}

/** How the numbers on this surface were accounted. */
export function AccountingNotice({ accounting, live }: { accounting: 'live-interval' | 'completed-flows'; live?: boolean }) {
  return <div className="notice" data-od-id="accounting-notice" role="status">
    <Badge tone="plain">{accounting === 'live-interval' ? 'Live interval accounting' : 'Completed-flow totals'}</Badge>
    <p>{accounting === 'live-interval'
      ? `Totals accumulate within the selected window${live ? ' and are still changing' : ''}; they are not comparable to completed-flow records.`
      : 'Totals count flows that completed within the window; in-progress conversations are excluded.'}</p>
  </div>;
}

/** Explicit measurement gaps in the selected window. */
export function GapNotice({ gaps }: { gaps: { from?: string; to?: string; reason?: string }[] }) {
  if (!gaps.length) return null;
  return <div className="notice" data-od-id="gap-notice" role="status">
    <Badge tone="warn">Missing measurements</Badge>
    <p>{gaps.length} gap{gaps.length === 1 ? '' : 's'} in this window{gaps[0]?.reason ? ` — ${gaps[0].reason}` : ''}. Chart paths break across gaps; a gap is not zero traffic.</p>
  </div>;
}

/** 403 for detail surfaces: Viewer keeps summaries, detail stays Operator-only. */
export function AccessDeniedNotice({ detail }: { detail?: string }) {
  return <div data-od-id="access-denied-notice">
    <Permission detail={detail || 'Traffic, DNS and investigation detail require the Operator or Administrator role. Summaries remain available.'} />
  </div>;
}
