import type { Meta, StoryObj } from '@storybook/react-vite';
import { demoPolicies, demoSources } from '../lib/demo';
import type { PolicyPagesState } from '../lib/policies';
import { PoliciesPanel } from './PoliciesPanel';

const policySources = demoSources.filter(s => /policy|rule|application/i.test(s.kind || ''));
const base: PolicyPagesState = {
  resource: { data: { items: demoPolicies, next_cursor: null, sources: policySources }, loading: false, reload: () => undefined },
  policies: demoPolicies,
  sources: policySources,
  nextCursor: null,
  atCap: false,
  loadedPages: 0,
  loadingMore: false,
  reconciling: false,
  pagesError: null,
  loadMore: () => undefined,
  reload: () => undefined,
};

const meta = {
  title: 'Investigation/PoliciesPanel',
  component: PoliciesPanel,
  args: {
    title: 'Installed rule observations',
    description: 'No policy prediction or device access grant is inferred from console sign-in.',
    pages: base,
    selectedRule: null,
    onInspect: () => undefined,
  },
} satisfies Meta<typeof PoliciesPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SinglePage: Story = {};
export const MorePagesAvailable: Story = { args: { pages: { ...base, nextCursor: '100' } } };
export const QueryWindowCap: Story = { args: { pages: { ...base, nextCursor: null, atCap: true, loadedPages: 3 } } };
export const StalePageFailure: Story = { args: { pages: { ...base, pagesError: { error: new Error('Request timed out. Try again.'), retry: 'reconcile' }, loadedPages: 2 } } };
export const Reconciling: Story = { args: { pages: { ...base, nextCursor: '100', reconciling: true, loadedPages: 1 } } };
export const SourcesUnavailable: Story = { args: { pages: { ...base, resource: { ...base.resource, data: { items: demoPolicies } }, sources: undefined } } };
