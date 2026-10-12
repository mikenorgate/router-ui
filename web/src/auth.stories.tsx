import type { Meta, StoryObj } from '@storybook/react-vite';
import { AuthProvider } from './auth';
const meta = { title: 'Access/Session provider', component: AuthProvider, args: { children: <p>Session context stays in memory; cookies are owned by the server.</p>, initialSession: { user: { id: 'example-user', name: 'Example evaluator', role: 'viewer' }, csrf_token: 'explicit-story-csrf', mode: 'fixture' } } } satisfies Meta<typeof AuthProvider>;
export default meta;
export const MemoryOnlySession: StoryObj<typeof meta> = {};
