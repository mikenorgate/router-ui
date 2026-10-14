import type { Meta, StoryObj } from '@storybook/react-vite';
import { demoOverview, demoEvents } from '../lib/demo';
import { Chart } from './Chart';
const meta = { title: 'Measurements/Aligned timeline', component: Chart, args: { series: demoOverview.series!, events: demoEvents } } satisfies Meta<typeof Chart>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MissingSamples: Story = {};
export const NoSeries: Story = { args: { series: [] } };
export const SelectableInterval: Story = { args: { onSelect: () => undefined } };
