import type { StorybookConfig } from '@storybook/react-vite';
import { readFileSync } from 'node:fs';

const favicon = `data:image/svg+xml;base64,${readFileSync(new URL('../../design/assets/lanrith-favicon.svg', import.meta.url)).toString('base64')}`;
const wordmark = `data:image/svg+xml;base64,${readFileSync(new URL('../../design/assets/lanrith-wordmark.svg', import.meta.url)).toString('base64')}`;
const identityHead = `<link rel="icon" type="image/svg+xml" href="${favicon}">`;
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  framework: '@storybook/react-vite',
  core: { disableTelemetry: true },
  managerHead: head => `${head}${identityHead}<script>window.lanrithStorybookWordmark = ${JSON.stringify(wordmark)};</script>`,
  previewHead: head => `${head}${identityHead}`,
};
export default config;
