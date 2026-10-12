import type { Meta, StoryObj } from '@storybook/react-vite';
import { Sidebar } from './Sidebar';
const meta = { title: 'Navigation/Sidebar', component: Sidebar, args: { theme: 'light', onTheme: () => undefined } } satisfies Meta<typeof Sidebar>;
export default meta;
export const SevenSections: StoryObj<typeof meta> = { render: args => <div className="shell"><Sidebar {...args} /><main className="main">Local router observations</main></div> };
