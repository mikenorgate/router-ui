import type { Meta, StoryObj } from '@storybook/react-vite';
import { demoEvents } from '../lib/demo';
import type { EventWithRef } from '../lib/contracts';
import { LinkedEventsTimeline } from './LinkedEventsTimeline';

const events: EventWithRef[] = demoEvents.map((event, index) => ({
  ...event,
  observation_ref: index === 0 ? 'obs-event-01' : undefined,
}));

const meta = {
  title: 'Phase 3/Linked events timeline',
  component: LinkedEventsTimeline,
  args: { events, filtersNote: 'Severity and kind filters apply on the router before pagination.' },
} satisfies Meta<typeof LinkedEventsTimeline>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Linked: Story = { args: { onInspectObservation: () => undefined } };
export const WithoutReferences: Story = { args: { events: demoEvents } };
export const EmptyFiltered: Story = { args: { events: [] } };
