import type { Meta, StoryObj } from '@storybook/react-vite';
import { DataTable } from './DataTable';
const meta = { title: 'Tables/DataTable', component: DataTable, args: { rows: [], columns: [], caption: 'Fictional bounded records.' } } satisfies Meta<typeof DataTable>;
export default meta;
type Story = StoryObj<typeof meta>;
export const BoundedSortable: Story = { render: () => <DataTable rows={[{ id: 'device-b', name: 'Example sensor' }, { id: 'device-a', name: 'Example workstation' }]} caption="Fictional records; sorting applies to this page." columns={[{ key: 'name', label: 'Name', sort: row => row.name, render: row => row.name }, { key: 'id', label: 'ID', render: row => <span className="mono">{row.id}</span> }]} /> };
export const EmptyResult: Story = { render: () => <DataTable rows={[]} columns={[]} caption="No matching records." onClear={() => undefined} /> };
