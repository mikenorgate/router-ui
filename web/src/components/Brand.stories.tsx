import type { Meta, StoryObj } from '@storybook/react-vite';
import { Brand } from './Brand';

const meta = { title: 'Identity/Lanrith', component: Brand, args: { label: 'Lanrith' } } satisfies Meta<typeof Brand>;
export default meta;
export const OutlinedWordmark: StoryObj<typeof meta> = {};
export const JunctionMark: StoryObj<typeof meta> = { args: { variant: 'mark', label: 'Lanrith junction mark' } };
