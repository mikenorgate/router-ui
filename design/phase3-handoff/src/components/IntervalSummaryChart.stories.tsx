import type { Meta, StoryObj } from '@storybook/react-vite';
import { demoEvents } from '../lib/demo';
import { phase3Summary } from '../lib/phase3Demo';
import { IntervalSummaryChart } from './IntervalSummaryChart';

const meta = {
  title: 'Phase 3/Interval summary chart',
  component: IntervalSummaryChart,
  args: { summary: phase3Summary, events: demoEvents },
} satisfies Meta<typeof IntervalSummaryChart>;
export default meta;
type Story = StoryObj<typeof meta>;

export const LiveWithGaps: Story = {};
export const CompletedNoGaps: Story = {
  args: {
    summary: {
      ...phase3Summary,
      accounting: 'completed-flows',
      interval: { ...phase3Summary.interval, live: false },
      gaps: [],
    },
  },
};
export const EmptySeries: Story = { args: { summary: { ...phase3Summary, series: [] } } };
export const Selectable: Story = { args: { onSelect: () => undefined } };
