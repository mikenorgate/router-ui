import type { Meta, StoryObj } from '@storybook/react-vite';
import { phase3Exposure } from '../lib/phase3Demo';
import { ExposurePanel } from './ExposurePanel';

const meta = {
  title: 'Phase 3/Exposure panel',
  component: ExposurePanel,
  args: { exposure: phase3Exposure },
} satisfies Meta<typeof ExposurePanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Configured: Story = {};
export const WithInspection: Story = { args: { onInspect: () => undefined } };
export const EmptyExposure: Story = { args: { exposure: { verified_externally: 'never', listeners: [], forwards: [], inbound: [], notes: [] } } };
export const UnsupportedSource: Story = {
  args: { exposure: { ...phase3Exposure, capabilities: [{ id: 'nat-mapping', supported: false, reason: 'Dynamic port mapping observation is unsupported by this image.' }] } },
};
