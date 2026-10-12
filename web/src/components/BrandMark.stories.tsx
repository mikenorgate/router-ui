import type { Meta, StoryObj } from '@storybook/react-vite';
import { BrandMark } from './BrandMark';
const meta = { title: 'Identity/Route junction', component: BrandMark, args: { size: 48 } } satisfies Meta<typeof BrandMark>;
export default meta;
export const CanonicalMark: StoryObj<typeof meta> = {};
