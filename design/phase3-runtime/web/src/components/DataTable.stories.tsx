import type { Meta, StoryObj } from '@storybook/react-vite';
import { DataTable } from './DataTable';
const meta = { title: 'Tables/DataTable', component: DataTable, args: { rows: [], columns: [], caption: 'Fictional bounded records.' } } satisfies Meta<typeof DataTable>;
export default meta;
type Story = StoryObj<typeof meta>;
export const BoundedSortable: Story = { render: () => <DataTable rows={[{ id: 'device-b', name: 'Example sensor' }, { id: 'device-a', name: 'Example workstation' }]} caption="Fictional records; sorting applies to this page." columns={[{ key: 'name', label: 'Name', sort: row => row.name, render: row => row.name }, { key: 'id', label: 'ID', render: row => <span className="mono">{row.id}</span> }]} /> };
export const EmptyResult: Story = { render: () => <DataTable rows={[]} columns={[]} caption="No matching records." onClear={() => undefined} /> };
const manyRows = Array.from({ length: 230 }, (_, i) => ({ id: `record-${String(i + 1).padStart(3, '0')}`, name: `Fictional record ${i + 1}`, value: (i + 1) * 7 }));
export const ClientPaginated: Story = { render: () => <DataTable rows={manyRows} paginate pageSize={100} pageResetKey="story" caption="Fictional loaded records; sorting covers all loaded records and the pager moves through the loaded set." columns={[{ key: 'name', label: 'Name', sort: row => row.name, render: row => row.name }, { key: 'value', label: 'Recorded value', sort: row => row.value, render: row => <span className="mono">{row.value}</span> }]} /> };
