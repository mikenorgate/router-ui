import type { Meta, StoryObj } from '@storybook/react-vite';
import { demoOverview } from '../lib/demo';
import { Metric } from './Metric';
const meta = { title: 'Measurements/Metric', component: Metric, args: { metric: demoOverview.metrics![0]! } } satisfies Meta<typeof Metric>;
export default meta;
type Story = StoryObj<typeof meta>;
export const CurrentSharedRate: Story = {};
export const Missing: Story = { args: { metric: demoOverview.metrics![3]! } };
export const StaleLastSuccess: Story = { args: { metric: demoOverview.metrics![2]! } };
