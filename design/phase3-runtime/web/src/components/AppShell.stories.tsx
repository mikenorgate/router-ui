import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppShell } from './AppShell';
import { PageHeader } from './UI';
const meta = { title: 'Navigation/AppShell', component: AppShell, args: { children: <PageHeader title="Overview" description="Router-local evidence." /> } } satisfies Meta<typeof AppShell>;
export default meta;
export const ResponsiveNavigation: StoryObj<typeof meta> = {};
