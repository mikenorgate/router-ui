import type { Meta, StoryObj } from '@storybook/react-vite';
import { AnnotationEditor } from './AnnotationEditor';
const meta = { title: 'Devices/AnnotationEditor', component: AnnotationEditor, args: { deviceId: 'device-a', alias: '', note: '', onSaved: () => undefined } } satisfies Meta<typeof AnnotationEditor>;
export default meta;
export const ConsoleOwnedWrite: StoryObj<typeof meta> = {};
export const ExistingNote: StoryObj<typeof meta> = { args: { alias: 'Example workstation', note: 'Local note; router policy remains read-only.' } };
