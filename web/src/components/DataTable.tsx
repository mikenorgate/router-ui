import { useMemo, useState, type ReactNode } from 'react';
import { text } from '../lib/format';
import { Empty, FilterSelect } from './UI';

export interface Column<T> { key: string; label: string; render: (row: T) => ReactNode; sort?: (row: T) => string | number | null | undefined }
export function DataTable<T extends { id: string }>({ rows, columns, caption, empty, selected, onClear }: { rows: T[]; columns: Column<T>[]; caption: string; empty?: string; selected?: string | null; onClear?: () => void }) {
  const [order, setOrder] = useState<{ key: string; desc: boolean }>({ key: '', desc: false });
  const sorted = useMemo(() => {
    const col = columns.find(c => c.key === order.key);
    if (!col?.sort) return rows;
    return [...rows].sort((a, b) => {
      const x = col.sort!(a), y = col.sort!(b);
      if (x == null) return y == null ? 0 : 1;
      if (y == null) return -1;
      const n = typeof x === 'number' && typeof y === 'number' ? x - y : text(x).localeCompare(text(y), 'en-GB', { numeric: true });
      return order.desc ? -n : n;
    });
  }, [rows, columns, order]);
  if (!rows.length) return <Empty title={empty || 'No matching observations'} detail="Try changing filters, or check source coverage and observation times." action={onClear && <button className="btn" onClick={onClear}>Clear filters</button>} />;
  return <div className="table-container" data-od-id="observations-table">
    <div className="mobile-sort"><FilterSelect label="Sort records" value={`${order.key}:${order.desc ? 'desc' : 'asc'}`} options={[[":asc", 'Observation order'], ...columns.filter(c => c.sort).flatMap(c => [[`${c.key}:asc`, `${c.label} · ascending`], [`${c.key}:desc`, `${c.label} · descending`]] as [string, string][])]} onChange={value => { const [key, direction] = value.split(':'); setOrder({ key: key || '', desc: direction === 'desc' }); }} /></div>
    <table className="table responsive"><caption>{caption}</caption><thead><tr>{columns.map(col => <th key={col.key} scope="col" aria-sort={col.sort ? order.key === col.key ? order.desc ? 'descending' : 'ascending' : 'none' : undefined}>{col.sort ? <button className="btn text" onClick={() => setOrder({ key: col.key, desc: order.key === col.key && !order.desc })}>{col.label}<span aria-hidden="true"> {order.key === col.key ? order.desc ? '↓' : '↑' : '↕'}</span></button> : col.label}</th>)}</tr></thead>
    <tbody>{sorted.slice(0, 200).map(row => <tr key={row.id} className={selected === row.id ? 'selected' : ''} data-od-id={`row-${row.id}`} aria-selected={selected === row.id || undefined}>{columns.map(col => <td key={col.key} data-label={col.label}><div>{col.render(row)}</div></td>)}</tr>)}</tbody></table>
    <div className="tablefoot"><span className="mono">{Math.min(rows.length, 200)} records in this bounded page</span><span>Sorting applies to this page</span></div>
  </div>;
}
