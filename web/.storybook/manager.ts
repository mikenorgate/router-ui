import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming';

const brandImage = (window as Window & { lanrithStorybookWordmark?: string }).lanrithStorybookWordmark;
addons.setConfig({ theme: create({ base: 'light', brandTitle: 'Lanrith console', brandImage }) });
