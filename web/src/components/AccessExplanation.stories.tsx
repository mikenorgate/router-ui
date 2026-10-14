import type { Meta, StoryObj } from '@storybook/react-vite';
import { phase3Investigations } from '../lib/phase3Demo';
import { AccessExplanation } from './AccessExplanation';

const meta = {
  title: 'Phase 3/Access explanation',
  component: AccessExplanation,
  args: { investigation: phase3Investigations['inv-access-flow-01']! },
} satisfies Meta<typeof AccessExplanation>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ObservedDenial: Story = {};
export const UnobservedPartial: Story = { args: { investigation: phase3Investigations['inv-access-flow-03']! } };
