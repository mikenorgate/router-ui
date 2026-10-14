import type { Meta, StoryObj } from '@storybook/react-vite';
import { Inspector } from './Inspector';
import { RuleDetail } from './PolicyTable';
import { demoPolicies } from '../lib/demo';
const meta = { title: 'Investigation/Inspector', component: Inspector, args: { title: 'Rule rule-042', onClose: () => undefined, children: <RuleDetail policy={demoPolicies[1]!} /> } } satisfies Meta<typeof Inspector>;
export default meta;
export const ModalProvenance: StoryObj<typeof meta> = {};
