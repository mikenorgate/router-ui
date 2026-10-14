import type { Meta, StoryObj } from '@storybook/react-vite';
import { SummaryCard } from './SummaryCard';

const meta = {
  title: 'Navigation/SummaryCard',
  component: SummaryCard,
  args: { id: 'summary-devices-total', label: 'Devices in inventory', value: 3, to: '/devices', hint: 'Observed identities and address associations ↗' },
  decorators: [Story => <div className="metric-strip"><Story /></div>],
} satisfies Meta<typeof SummaryCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Count: Story = {};
export const LargeCompactValue: Story = { args: { id: 'summary-traffic', label: 'Recorded conversations', value: 48213, to: '/traffic', hint: 'Traffic flow observations ↗' } };
export const UnsupportedProducer: Story = { args: { id: 'summary-traffic', label: 'Recorded conversations', value: null, to: '/traffic', hint: 'No flow producer configured', unsupported: true } };
