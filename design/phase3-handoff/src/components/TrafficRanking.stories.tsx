import type { Meta, StoryObj } from '@storybook/react-vite';
import { phase3Summary } from '../lib/phase3Demo';
import { TrafficRanking } from './TrafficRanking';

const meta = {
  title: 'Phase 3/Traffic ranking',
  component: TrafficRanking,
  args: {
    rankings: phase3Summary.rankings!,
    unattributed: phase3Summary.unattributed!,
    accounting: 'live-interval' as const,
  },
} satisfies Meta<typeof TrafficRanking>;
export default meta;
type Story = StoryObj<typeof meta>;

export const LiveInterval: Story = {};
export const CompletedFlows: Story = { args: { accounting: 'completed-flows' } };
export const EmptyWindow: Story = { args: { rankings: [], unattributed: undefined } };
export const WithInspection: Story = { args: { onInspect: () => undefined } };
