// Phase 3 Access Explanation page — the full-page, shareable form of the
// explanation that a flow inspector opens. Passive: it reports the observed
// decision, policy provenance, binding and translation evidence, and lists
// unresolved questions. Operator-only; Viewer sessions get the denied state.
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth';
import type { AccessInvestigation } from '../lib/contracts';
import { investigationPath } from '../lib/phase3Api';
import { useFilters, useResource } from '../lib/hooks';
import { AccessExplanation } from '../components/AccessExplanation';
import { AccessDeniedNotice } from '../components/EvidenceNotices';
import { PageHeader, Panel, RequestState } from '../components/UI';

export function AccessExplanationPage() {
  const { ref = '' } = useParams();
  const filters = useFilters();
  const { session } = useAuth();
  const viewer = session?.user.role === 'viewer';
  const resource = useResource<AccessInvestigation>(viewer ? null : investigationPath(ref));
  return <>
    <PageHeader title="Access explanation" description="Passive explanation of one recorded subject: observed decision, policy provenance, binding and translation evidence." parent="Traffic">
      <Link className="btn" to={filters.href('/traffic')}>Return to traffic</Link>
    </PageHeader>
    {viewer ? <AccessDeniedNotice detail="Investigations resolve recorded traffic and policy detail and require the Operator or Administrator role." /> : (
      <RequestState resource={resource}>{investigation => <>
        <Panel title={`Explanation ${investigation.ref}`} description="Reading order: what was observed, what policy says, what evidence binds them, and what remains unresolved.">
          <AccessExplanation investigation={investigation} />
        </Panel>
      </>}</RequestState>
    )}
  </>;
}
