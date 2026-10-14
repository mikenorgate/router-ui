import type { Meta, StoryObj } from '@storybook/react-vite';
import { ExportButton } from './ExportButton';
const meta = { title: 'Access/ExportButton', component: ExportButton } satisfies Meta<typeof ExportButton>;
export default meta;
export const RoleScoped: StoryObj<typeof meta> = {};
