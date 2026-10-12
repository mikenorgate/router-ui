import type { Preview } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../src/auth';
import { createDemo } from '../src/lib/demo';
import type { Role } from '../src/types';
import '../src/styles.css';
const preview: Preview = {
  initialGlobals: { theme: 'light', role: 'operator' },
  globalTypes: {
    theme: { description: 'Design-system theme', toolbar: { icon: 'circlehollow', items: ['light', 'dark'] } },
    role: { description: 'Fixture permissions', toolbar: { icon: 'user', items: ['viewer', 'operator', 'admin'] } },
  },
  decorators: [(Story, context) => {
    const role = context.globals.role as Role;
    document.documentElement.dataset.theme = context.globals.theme as string;
    const adapter = createDemo(role);
    // Storybook is explicitly a local fixture surface; production request code is unchanged.
    window.fetch = async (input, init) => {
      const url = String(input);
      if (!url.startsWith('/api/v1/')) throw new Error('Stories only permit the local fixture API.');
      try { return Response.json(await adapter(url.slice('/api/v1'.length), init)); }
      catch (error) { const e = error as { status?: number; code?: string; message?: string }; return Response.json({ error: { code: e.code, message: e.message } }, { status: e.status || 500 }); }
    };
    return <MemoryRouter key={`${context.id}:${role}`} initialEntries={[context.parameters.route || '/overview']}><AuthProvider initialSession={{ user: { id: 'example-user', name: 'Example evaluator', role }, csrf_token: 'explicit-demo-csrf', mode: 'fixture' }}><div style={{ padding: 24 }}><Story /></div></AuthProvider></MemoryRouter>;
  }],
  parameters: { layout: 'fullscreen' },
};
export default preview;
