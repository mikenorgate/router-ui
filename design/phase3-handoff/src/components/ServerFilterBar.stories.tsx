import type { Meta, StoryObj } from '@storybook/react-vite';
import { ServerFilterBar } from './ServerFilterBar';

const meta = {
  title: 'Phase 3/Server filter bar',
  component: ServerFilterBar,
  args: {
    values: new URLSearchParams('verdict=blocked'),
    onChange: () => undefined,
    onClear: () => undefined,
    searchLabel: 'Search flows',
    searchHint: 'Address, name, protocol or rule',
    filters: [
      { key: 'verdict', label: 'Verdict', options: [['', 'All verdicts'], ['allowed', 'Allowed'], ['blocked', 'Blocked'], ['unknown', 'Unknown']] },
      { key: 'family', label: 'Family', options: [['', 'Both families'], ['4', 'IPv4'], ['6', 'IPv6']] },
    ],
  },
} satisfies Meta<typeof ServerFilterBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const FlowFilters: Story = {};
export const WithoutSearch: Story = { args: { searchLabel: undefined, values: new URLSearchParams() } };
