// Component regressions for recorded DNS answers: an unobserved response
// keeps answers unknown (never a zero count), the answers_omitted warning
// shows over typed answer records AND over bare answer values, and the
// observation inspector keeps the query time, transaction identity and the
// binding frozen at observation time visible.
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth';
import type { DnsObservation, Observation } from '../lib/contracts';
import { dnsAnswerCount } from '../lib/dns';
import type { Session } from '../types';
import { DnsAnswers } from './DnsAnswers';
import { ObservationInspector } from './ObservationInspector';

const operator: Session = { user: { id: 'user', name: 'Operator', role: 'operator' }, csrf_token: 'test-csrf', mode: 'production' };
const base: DnsObservation = { id: 'dns-t', device_id: 'device-a', query: 'app.example', type: 'A', result: 'NOERROR' };

describe('DnsAnswers', () => {
  it('keeps an unobserved response unknown — answers are never zero', () => {
    render(<DnsAnswers record={{ ...base, result: 'UNOBSERVED_RESPONSE', answers: [], answer_records: [] }} />);
    expect(screen.getByText('Response metadata unobserved; answers unknown')).toBeInTheDocument();
    expect(screen.queryByText(/0 answers/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Answers unavailable/)).not.toBeInTheDocument();
    // The accessor never reports a numeric count for an unobserved response,
    // even if a producer attached a count field to the record.
    expect(dnsAnswerCount({ ...base, result: 'UNOBSERVED_RESPONSE', answer_count: 0, answers: [] })).toBeNull();
  });
  it('shows the omitted warning with the recorded count over typed answer records', () => {
    render(<DnsAnswers record={{
      ...base, answers: ['198.51.100.70'], answer_count: 4, answers_omitted: true,
      answer_records: [{ name: 'app.example', type: 'A', value: '198.51.100.70', ttl: 120 }],
    }} />);
    expect(screen.getByText(/198\.51\.100\.70/)).toBeInTheDocument();
    expect(screen.getByText(/TTL 120 s/)).toBeInTheDocument();
    expect(screen.getByText('4 answers observed; some values omitted')).toBeInTheDocument();
  });
  it('shows the omitted warning without a recorded count over typed answer records', () => {
    render(<DnsAnswers record={{ ...base, answers_omitted: true, answer_records: [{ value: '198.51.100.70' }] }} />);
    expect(screen.getByText('Some answer values omitted')).toBeInTheDocument();
  });
  it('shows the omitted warning even when only bare answer values exist', () => {
    render(<DnsAnswers record={{ ...base, answers: ['198.51.100.70', '198.51.100.71'], answer_count: 5, answers_omitted: true }} />);
    expect(screen.getByText(/198\.51\.100\.70, 198\.51\.100\.71/)).toBeInTheDocument();
    expect(screen.getByText('TTLs not retained for these answers')).toBeInTheDocument();
    expect(screen.getByText('5 answers observed; some values omitted')).toBeInTheDocument();
  });
  it('renders a count-only legacy record as a labelled count, never invented values', () => {
    render(<DnsAnswers record={{ id: 'dns-legacy', query_name: 'legacy.example', query_type: 'A', rcode: 'NOERROR', answers: 2 }} />);
    expect(screen.getByText('2 answers · values not retained')).toBeInTheDocument();
  });
  it('keeps unrecorded answers unavailable', () => {
    render(<DnsAnswers record={{ ...base, answers: null }} />);
    expect(screen.getByText('Answers unavailable')).toBeInTheDocument();
  });
});

describe('ObservationInspector DNS metadata', () => {
  it('shows query time, transaction identity and the binding frozen at observation time', async () => {
    const observation: Observation = {
      identity: { ref: 'obs-dns-t', kind: 'dns', source_id: 'flow-observer', source_kind: 'Resolver metadata', boot_id: 'boot-example-7f2c', record_id: 'seq-6001', recorded_at: '2026-10-14T08:30:00Z' },
      record: {
        ...base,
        answers: ['198.51.100.70'], client_ip: '192.0.2.24', resolver: 'router-local', latency_ms: 9,
        query_at: '2026-10-14T08:29:58Z', transaction_id: 'example-txn-6001',
        binding: { device_id: 'device-a', address: '192.0.2.24', valid_from: '2026-10-14T06:00:00Z', valid_until: null, source: 'Local lease' },
        observed_at: '2026-10-14T08:30:00Z',
      },
      evidence: 'Resolver metadata association, recorded at query time.',
    };
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(observation)));
    render(<MemoryRouter><AuthProvider initialSession={operator}><ObservationInspector reference="obs-dns-t" onClose={() => undefined} /></AuthProvider></MemoryRouter>);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Query recorded at')).toBeInTheDocument();
    expect(within(dialog).getByText('2026-10-14 08:29:58 UTC')).toBeInTheDocument();
    expect(within(dialog).getByText('Transaction')).toBeInTheDocument();
    expect(within(dialog).getByText('example-txn-6001')).toBeInTheDocument();
    expect(within(dialog).getByText('Binding at observation time')).toBeInTheDocument();
    expect(within(dialog).getByText(/192\.0\.2\.24 · 2026-10-14 06:00:00 UTC → End not recorded · Local lease/)).toBeInTheDocument();
    // Reference identity stays visible beside the record metadata.
    expect(within(dialog).getByText('seq-6001')).toBeInTheDocument();
    expect(within(dialog).getByText('boot-example-7f2c')).toBeInTheDocument();
  });
  it('labels query time and transaction as unavailable when the producer did not record them', async () => {
    const observation: Observation = {
      identity: { ref: 'obs-dns-sparse', kind: 'dns', source_id: 'flow-observer', record_id: 'seq-6002', recorded_at: '2026-10-14T08:31:00Z' },
      record: { ...base, answers: ['198.51.100.70'], observed_at: '2026-10-14T08:31:00Z' },
    };
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(observation)));
    render(<MemoryRouter><AuthProvider initialSession={operator}><ObservationInspector reference="obs-dns-sparse" onClose={() => undefined} /></AuthProvider></MemoryRouter>);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByText('Observation time unavailable').length).toBeGreaterThan(0);
    expect(within(dialog).getByText('Transaction identity unavailable')).toBeInTheDocument();
    expect(within(dialog).getByText('No binding recorded for this observation')).toBeInTheDocument();
  });
});
