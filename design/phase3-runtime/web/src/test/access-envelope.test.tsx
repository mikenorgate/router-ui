// Access explanation against the actual investigations envelope:
// {identity:{ref,kind,source_id,boot_id,record_id,recorded_at}, subject,
// observed_decision, policy_path, binding, translation, events, limits,
// unresolved_questions, sources} — with NO top-level ref. The page heading
// must be the short producer record id, never the opaque resolution
// reference, so narrow layouts never have to absorb a hundreds-char string.
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth';
import type { AccessInvestigation } from '../lib/contracts';
import { AccessExplanationPage } from '../pages/AccessExplanationPage';
import type { Session } from '../types';

const operator: Session = { user: { id: 'user', name: 'Operator', role: 'operator' }, csrf_token: 'test-csrf', mode: 'production' };

/** 300-character opaque reference, URL-safe as the contract requires. */
const OPAQUE = `inv-${'a'.repeat(296)}`;

// The actual envelope shape: identity carries the opaque reference; there is
// deliberately no top-level ref field on this payload.
const envelope: AccessInvestigation = {
  identity: { ref: OPAQUE, kind: 'investigation', source_id: 'flow-observer', source_kind: 'Flow metadata', boot_id: 'boot-example-7f2c', record_id: 'inv-0094', recorded_at: '2026-10-14T08:30:00Z' },
  subject: { device_id: 'device-a', source: '192.0.2.24', destination: '198.51.100.60', protocol: 'TCP', destination_port: 443, queried_at: '2026-10-14T08:30:05Z' },
  observed_decision: { verdict: 'blocked', evidence: 'Attributed deny verdict recorded at the forwarding observation point. This does not describe application connectivity.', observed_at: '2026-10-14T08:29:58Z', observation_ref: 'obs-flow-01' },
  policy_path: [
    { step: 'Segment egress restriction', rule_id: 'rule-042', action: 'deny', scope: 'Inherited · Example segment A', hook: 'forward', order: 42, installed: true, applicable: true, observed_match: true, counters_scope: 'shared' },
  ],
  binding: { device_id: 'device-a', address: '192.0.2.24', valid_from: '2026-10-14T06:00:00Z', valid_until: null, source: 'Local lease' },
  translation: { recorded: false, note: 'No translation recorded for this tuple; none is inferred.' },
  events: [],
  limits: ['Flow collection samples one in four conversations; absence of a record is not absence of traffic.'],
  unresolved_questions: ['Did the application handshake complete? No application-level evidence exists.'],
  sources: [],
};

function renderPage() {
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === `/api/v1/investigations/${OPAQUE}`) return Response.json(envelope);
    return Response.json({ error: { code: 'not_found', message: 'Investigation unavailable.' } }, { status: 404 });
  });
  vi.stubGlobal('fetch', fetch);
  render(<MemoryRouter initialEntries={[`/investigations/${OPAQUE}`]}><AuthProvider initialSession={operator}><Routes><Route path="/investigations/:ref" element={<AccessExplanationPage />} /></Routes></AuthProvider></MemoryRouter>);
  return fetch;
}

describe('Access explanation — actual investigations envelope', () => {
  it('heads the page with the short record id, never the opaque reference, so narrow layouts stay safe', async () => {
    expect(OPAQUE).toHaveLength(300);
    const fetch = renderPage();
    // The record resolves by the opaque reference over the wire…
    const heading = await screen.findByRole('heading', { name: 'Explanation inv-0094' });
    expect(fetch).toHaveBeenCalledWith(`/api/v1/investigations/${OPAQUE}`, expect.anything());
    // …yet the heading is the short producer record id, bounded for narrow
    // layouts, and the hundreds-char reference is rendered nowhere.
    expect(heading.textContent).toBe('Explanation inv-0094');
    expect(heading.textContent!.length).toBeLessThanOrEqual(40);
    expect(document.body.textContent).not.toContain(OPAQUE);
    // The actual envelope still explains the recorded subject passively.
    expect(screen.getByText('Observed decision')).toBeInTheDocument();
    expect(screen.getByText('Recorded policy context')).toBeInTheDocument();
    expect(screen.getByText('Unresolved questions')).toBeInTheDocument();
    expect(screen.queryByText(/[Ss]imulat/)).not.toBeInTheDocument();
  });
  it('exposes the recorded source, boot, producer record and capture time identity', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Explanation inv-0094' });
    expect(screen.getByText('Investigation record')).toBeInTheDocument();
    expect(screen.getByText('Flow metadata · flow-observer')).toBeInTheDocument();
    expect(screen.getByText('boot-example-7f2c')).toBeInTheDocument();
    expect(screen.getByText('inv-0094')).toBeInTheDocument();
    expect(screen.getByText('2026-10-14 08:30:00 UTC')).toBeInTheDocument();
  });
});
