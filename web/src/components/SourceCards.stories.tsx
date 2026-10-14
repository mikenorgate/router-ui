import type { Meta, StoryObj } from '@storybook/react-vite';
import { demoSources } from '../lib/demo';
import { SourceCards } from './SourceCards';
const meta = { title: 'Evidence/SourceCards', component: SourceCards, args: { sources: demoSources } } satisfies Meta<typeof SourceCards>;
export default meta;
export const FreshStaleSampledUnsupported: StoryObj<typeof meta> = {};
export const SparseEvidence: StoryObj<typeof meta> = { args: { sources: [{ id: 'radio-observer', kind: 'Wireless metrics', status: 'unsupported', coverage: 'No local wireless observation source' }] } };
export const EmptyState: StoryObj<typeof meta> = { args: { sources: [] } };
