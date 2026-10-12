import type { Meta, StoryObj } from '@storybook/react-vite';
import { demoFlows } from '../lib/demo';
import { FlowDetail, FlowTable } from './FlowTable';
const meta = { title: 'Investigation/FlowTable', component: FlowTable, args: { flows: demoFlows, onInspect: () => undefined } } satisfies Meta<typeof FlowTable>;
export default meta;
export const RecordedConversations: StoryObj<typeof meta> = {};
export const UnknownVerdict: StoryObj<typeof meta> = { render: () => <FlowDetail flow={demoFlows[2]!} /> };
export const PartialTranslation: StoryObj<typeof meta> = { render: () => <FlowDetail flow={demoFlows[1]!} /> };
