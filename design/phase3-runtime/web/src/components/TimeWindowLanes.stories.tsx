import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Series } from '../types';
import { TimeWindowLanes } from './TimeWindowLanes';

const at = (minutes: number) => new Date(Date.parse('2026-10-13T15:00:00Z') - (60 - minutes) * 60_000).toISOString();
const lanes: Series[] = [
  { id: 'traffic', label: 'Traffic rate', unit: 'Mbit/s', points: Array.from({ length: 31 }, (_, i) => ({ time: at(i * 2), value: i === 20 || i === 21 ? null : Math.round(4 + 30 * Math.exp(-((i - 13) ** 2) / 25) + (i % 3)) })) },
  { id: 'dns', label: 'DNS queries', unit: 'queries', points: Array.from({ length: 31 }, (_, i) => ({ time: at(i * 2), value: i === 20 || i === 21 ? null : 2 + (i % 4) })) },
  { id: 'blocked', label: 'Blocked connections', unit: 'connections', points: Array.from({ length: 31 }, (_, i) => ({ time: at(i * 2), value: i >= 16 && i <= 19 ? 3 : 0 })) },
];

const meta = {
  title: 'Phase 3/Time window lanes',
  component: TimeWindowLanes,
  args: {
    lanes,
    markers: [
      { time: at(34), label: 'Recorded grant expiry passed', kind: 'policy' },
      { time: at(40), label: 'Collection gap began', kind: 'collection' },
    ],
  },
} satisfies Meta<typeof TimeWindowLanes>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AlignedLanes: Story = {};
export const Selectable: Story = { args: { onSelect: () => undefined } };
export const EmptyWindow: Story = { args: { lanes: [] } };
