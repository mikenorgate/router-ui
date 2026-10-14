import type { Meta, StoryObj } from '@storybook/react-vite';
import { phase3Dns } from '../lib/phase3Demo';
import { DnsTable } from './DnsTable';

const meta = {
  title: 'Phase 3/DNS observations',
  component: DnsTable,
  args: { records: phase3Dns, onInspect: () => undefined },
} satisfies Meta<typeof DnsTable>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OperatorView: Story = {};
export const ViewerRedacted: Story = { args: { restricted: true } };
export const EmptyWindow: Story = { args: { records: [] } };
export const WithoutReferences: Story = { args: { records: phase3Dns.map(({ observation_ref, ...rest }) => rest) } };
