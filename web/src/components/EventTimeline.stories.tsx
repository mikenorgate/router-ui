import type { Meta, StoryObj } from '@storybook/react-vite';
import { demoEvents } from '../lib/demo';
import { EventTimeline } from './EventTimeline';
const meta = { title: 'Evidence/EventTimeline', component: EventTimeline, args: { events: demoEvents } } satisfies Meta<typeof EventTimeline>;
export default meta;
export const LinkedEvents: StoryObj<typeof meta> = {};
export const NoEvents: StoryObj<typeof meta> = { args: { events: [] } };
