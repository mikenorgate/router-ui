import type { Meta, StoryObj } from '@storybook/react-vite';
import { demoOverview } from '../lib/demo';
import type { MetricRecord } from '../types';
import { Metric } from './Metric';
const meta = { title: 'Measurements/Metric', component: Metric, args: { metric: demoOverview.metrics![0]! } } satisfies Meta<typeof Metric>;
export default meta;
type Story = StoryObj<typeof meta>;
function metric(overrides: Partial<MetricRecord>): MetricRecord {
  return { id: 'download', label: 'Interface receive rate', unit: 'bit/s', observed_at: new Date(Date.now() - 30_000).toISOString(), status: 'current', scope: 'Router interface · shared', ...overrides };
}
export const CurrentSharedRate: Story = {};
export const Missing: Story = { args: { metric: demoOverview.metrics![3]! } };
export const StaleLastSuccess: Story = { args: { metric: demoOverview.metrics![2]! } };
export const HumanisedRawBitsPerSecond: Story = { args: { metric: metric({ value: 2903738.04 }) } };
export const GigabitRate: Story = { args: { metric: metric({ value: 968400000 }) } };
export const SubKilobitRate: Story = { args: { metric: metric({ value: 512.4 }) } };
