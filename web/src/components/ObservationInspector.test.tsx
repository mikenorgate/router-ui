// Observation-point regression: the backend serializes the conntrack zone as
// uint16, and zone 0 is a valid zone. The inspector must preserve it and
// render it explicitly as "Zone 0" instead of dropping it as falsy.
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth';
import type { Observation } from '../lib/contracts';
import type { Flow, Session } from '../types';
import { ObservationInspector } from './ObservationInspector';

const operator: Session = { user: { id: 'user', name: 'Operator', role: 'operator' }, csrf_token: 'test-csrf', mode: 'production' };

function flowObservation(record: Partial<Flow>): Observation {
  return {
    identity: { ref: 'obs-flow-zone', kind: 'flow', source_id: 'flow-observer', source_kind: 'Flow metadata', boot_id: 'boot-example-7f2c', record_id: 'seq-7001', recorded_at: '2026-10-14T08:30:00Z' },
    record: { id: 'flow-zone', ...record },
  };
}

function renderInspector(observation: Observation) {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(observation)));
  render(<MemoryRouter><AuthProvider initialSession={operator}><ObservationInspector reference="obs-flow-zone" onClose={() => undefined} /></AuthProvider></MemoryRouter>);
  return screen.findByRole('dialog');
}

describe('ObservationInspector observation point', () => {
  it('preserves numeric zone 0 and renders it explicitly as Zone 0', async () => {
    const dialog = await renderInspector(flowObservation({ namespace: 'forwarding', zone: 0, observation_point: 'egress-interface' }));
    expect(within(dialog).getByText('forwarding · Zone 0 · egress-interface')).toBeInTheDocument();
    expect(within(dialog).queryByText('Observation point unrecorded')).not.toBeInTheDocument();
  });
  it('keeps Zone 0 visible even without a namespace or observation point', async () => {
    const dialog = await renderInspector(flowObservation({ zone: 0 }));
    expect(within(dialog).getByText('Zone 0')).toBeInTheDocument();
    expect(within(dialog).queryByText('Observation point unrecorded')).not.toBeInTheDocument();
  });
  it('renders non-zero numeric zones as recorded', async () => {
    const dialog = await renderInspector(flowObservation({ namespace: 'forwarding', zone: 5, observation_point: 'egress-interface' }));
    expect(within(dialog).getByText('forwarding · 5 · egress-interface')).toBeInTheDocument();
  });
  it('keeps recorded string zone labels verbatim', async () => {
    const dialog = await renderInspector(flowObservation({ namespace: 'forwarding', zone: 'example-segment-a', observation_point: 'egress-interface' }));
    expect(within(dialog).getByText('forwarding · example-segment-a · egress-interface')).toBeInTheDocument();
  });
});
