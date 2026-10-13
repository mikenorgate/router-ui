import type { ReactNode } from 'react';
import type { Policy } from '../types';
import { POLICY_PAGE_LIMIT, type PolicyPagesState } from '../lib/policies';
import { PolicyTable } from './PolicyTable';
import { SourceCards } from './SourceCards';
import { Panel, RequestState } from './UI';

export function PoliciesPanel({
  title,
  description,
  pages,
  selectedRule,
  onInspect,
  onRefresh,
  filters,
  pageResetKey,
}: {
  title: string;
  description: string;
  pages: PolicyPagesState;
  selectedRule?: string | null;
  onInspect: (policy: Policy) => void;
  onRefresh?: () => void;
  filters?: ReactNode;
  /** Device/search/filter context; a change returns the client pager to the first page. */
  pageResetKey?: string;
}) {
  return (
    <Panel title={title} description={description} action={onRefresh && <button className="btn" onClick={onRefresh}>Refresh snapshot</button>}>
      {filters}
      <RequestState resource={pages.resource}>{() => (
        <>
          <PolicyTable policies={pages.policies} selected={selectedRule} onInspect={onInspect} pageResetKey={pageResetKey} />
          {pages.pagesError && (
            <div className="notice error" role="alert" data-od-id="policy-pages-error">
              <p>
                {pages.pagesError.retry === 'reconcile'
                  ? 'Refreshing the loaded pages failed; the previous page set is retained. '
                  : 'Loading the next page failed; loaded rows are retained. '}
                {pages.pagesError.error.message}
              </p>
              <button className="btn" onClick={pages.pagesError.retry === 'reconcile' ? pages.reload : pages.loadMore}>Retry</button>
            </div>
          )}
          {pages.reconciling && <p className="sub" role="status">Refreshing loaded pages…</p>}
          {pages.nextCursor ? (
            <div className="panel-pages">
              <button className="btn" onClick={pages.loadMore} disabled={pages.loadingMore || pages.reconciling}>
                {pages.loadingMore ? 'Loading policies…' : pages.reconciling ? 'Refreshing loaded pages…' : 'Load more policies'}
              </button>
              <p className="sub">Pages load {POLICY_PAGE_LIMIT} rules at a time from the current filtered query.</p>
            </div>
          ) : pages.atCap ? (
            <p className="callout" data-od-id="policy-window-cap">
              The query limit was reached; matching rules beyond the limit are not shown. Narrow the search text or evidence filter to bring them into scope.
            </p>
          ) : null}
          <div className="sources-block">
            <h3>Policy evidence sources</h3>
            <p className="sub">Coverage and the original observation age qualify every installed-policy claim above.</p>
            {pages.sources === undefined
              ? <p className="callout">Source coverage unavailable in this response.</p>
              : <SourceCards sources={pages.sources} />}
          </div>
        </>
      )}</RequestState>
    </Panel>
  );
}
