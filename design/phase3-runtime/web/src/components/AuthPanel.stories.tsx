import type { Meta, StoryObj } from '@storybook/react-vite';
import { AuthPanel } from './AuthPanel';
const meta = { title: 'Access/AuthPanel', component: AuthPanel } satisfies Meta<typeof AuthPanel>;
export default meta;
export const ProviderUnavailableLocalRecovery: StoryObj<typeof meta> = {};
