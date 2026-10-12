import type { Meta, StoryObj } from '@storybook/react-vite';
import { demoSources } from '../lib/demo';
import { SourceTable } from './SourceTable';
const meta = { title: 'Evidence/SourceTable', component: SourceTable, args: { sources: demoSources } } satisfies Meta<typeof SourceTable>;
export default meta;
export const FreshStaleSampledUnsupported: StoryObj<typeof meta> = {};
