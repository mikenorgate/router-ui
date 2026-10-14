import type { Meta, StoryObj } from '@storybook/react-vite';
import { AccountingNotice, GapNotice, OverflowNotice, PartialNotice, SamplingNotice, StaleNotice, UnsupportedNotice } from './EvidenceNotices';

const meta = {
  title: 'Phase 3/Evidence notices',
  component: StaleNotice,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof StaleNotice>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Stale: Story = { args: { observedAt: '2026-10-13T14:58:00Z' } };
export const Partial: Story = { render: () => <PartialNotice detail="Two of five sources answered this window; the remaining sources are stale." /> };
export const Unsupported: Story = { render: () => <UnsupportedNotice detail="No qualified packet-loss source exists on this image." /> };
export const Overflow: Story = { render: () => <OverflowNotice shown={50} limit={50} /> };
export const Sampling: Story = { render: () => <SamplingNotice sourceRate={0.25} storageRate={1} note="Collection samples one in four conversations." /> };
export const AccountingLive: Story = { render: () => <AccountingNotice accounting="live-interval" live /> };
export const AccountingCompleted: Story = { render: () => <AccountingNotice accounting="completed-flows" /> };
export const Gaps: Story = { render: () => <GapNotice gaps={[{ from: '2026-10-13T14:40:00Z', to: '2026-10-13T14:44:00Z', reason: 'collector restart' }] } /> };
export const NoGaps: Story = { render: () => <GapNotice gaps={[]} /> };
