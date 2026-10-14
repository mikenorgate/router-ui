import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { handlePhase3Demo } from '../lib/phase3Demo';
import { ObservationInspector } from './ObservationInspector';

// Self-contained fixture transport: the phase 3 demo routes are served for the
// lifetime of the story, so it works before handlePhase3Demo is wired into
// lib/demo.ts (integration step 4 in README.md).
function Phase3FetchDecorator(Story: () => React.ReactNode) {
  useEffect(() => {
    const previous = window.fetch;
    window.fetch = async input => {
      const url = new URL(String(input), window.location.origin);
      const handled = handlePhase3Demo(url.pathname.replace(/^\/api\/v1/, ''), url, 'operator');
      if (handled !== undefined) return new Response(JSON.stringify(handled), { status: 200, headers: { 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ error: { code: 'not_retained', message: 'Observation not retained. It may be outside the retention window or sampled away.' } }), { status: 404 });
    };
    return () => { window.fetch = previous; };
  }, []);
  return <Story />;
}

const meta = {
  title: 'Phase 3/Observation inspector',
  component: ObservationInspector,
  decorators: [Phase3FetchDecorator],
  args: { reference: 'obs-flow-01', onClose: () => undefined },
} satisfies Meta<typeof ObservationInspector>;
export default meta;
type Story = StoryObj<typeof meta>;

export const FlowRecord: Story = {};
export const DnsRecord: Story = { args: { reference: 'obs-dns-01' } };
export const OutsideRetention: Story = { args: { reference: 'obs-evicted-99' } };
