import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { text } from '../lib/format';
import { Empty, FilterSelect } from './UI';

export interface Column<T> { key: string; label: string; render: (row: T) => ReactNode; sort?: (row: T) => string | number | null | undefined }
/** Hard ceiling for a rendered client page; keeps every rendered page bounded. */
export const CLIENT_PAGE_MAX = 200;

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  caption: string;
  empty?: string;
  selected?: string | null;
  onClear?: () => void;
  /** Opt-in client pagination over the loaded rows. Without it the first 200 rows render as one bounded page. */
  paginate?: boolean;
  /** Rows per client page when paginate is set. Clamped to CLIENT_PAGE_MAX. */
  pageSize?: number;
  /** Query context (device/search/filters). When it changes the client page resets to the first page. */
  pageResetKey?: string;
}

export function DataTable<T extends { id: string }>({ rows, columns, caption, empty, selected, onClear, paginate = false, pageSize = 100, pageResetKey }: DataTableProps<T>) {
  const [order, setOrder] = useState<{ key: string; desc: boolean }>({ key: '', desc: false });
  const [page, setPage] = useState(0);
  const size = Math.max(1, Math.min(CLIENT_PAGE_MAX, Math.floor(pageSize) || 100));
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
  // A new query context (device, search text, evidence filter) returns to the first client page.
  useEffect(() => { setPage(0); }, [pageResetKey]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / size));
  // A shrunken loaded set (narrower filters, fewer pages) clamps the current page into range.
  useEffect(() => { if (page > pageCount - 1) setPage(pageCount - 1); }, [page, pageCount]);
  if (!rows.length) return <Empty title={empty || 'No matching observations'} detail="Try changing filters, or check source coverage and observation times." action={onClear && <button className="btn" onClick={onClear}>Clear filters</button>} />;
  // Sorting covers the full loaded set; only after sorting is the visible client page sliced.
  const current = Math.min(page, pageCount - 1);
  const visible = paginate ? sorted.slice(current * size, current * size + size) : sorted.slice(0, CLIENT_PAGE_MAX);
  const first = current * size + 1;
  const last = current * size + visible.length;
  return <div className="table-container" data-od-id="observations-table">
    <div className="mobile-sort"><FilterSelect label="Sort records" value={`${order.key}:${order.desc ? 'desc' : 'asc'}`} options={[[":asc", 'Observation order'], ...columns.filter(c => c.sort).flatMap(c => [[`${c.key}:asc`, `${c.label} · ascending`], [`${c.key}:desc`, `${c.label} · descending`]] as [string, string][])]} onChange={value => { const [key, direction] = value.split(':'); setOrder({ key: key || '', desc: direction === 'desc' }); }} /></div>
    <table className="table responsive"><caption>{caption}</caption><thead><tr>{columns.map(col => <th key={col.key} scope="col" aria-sort={col.sort ? order.key === col.key ? order.desc ? 'descending' : 'ascending' : 'none' : undefined}>{col.sort ? <button className="btn text" onClick={() => setOrder({ key: col.key, desc: order.key === col.key && !order.desc })}>{col.label}<span aria-hidden="true"> {order.key === col.key ? order.desc ? '↓' : '↑' : '↕'}</span></button> : col.label}</th>)}</tr></thead>
    <tbody>{visible.map(row => <tr key={row.id} className={selected === row.id ? 'selected' : ''} data-od-id={`row-${row.id}`} aria-selected={selected === row.id || undefined}>{columns.map(col => <td key={col.key} data-label={col.label}><div>{col.render(row)}</div></td>)}</tr>)}</tbody></table>
    {paginate ? <div className="tablefoot"><span className="mono" role="status">Showing {first}–{last} of {sorted.length} loaded records</span><span>Sorting covers all loaded records</span></div>
      : <div className="tablefoot"><span className="mono">{Math.min(rows.length, CLIENT_PAGE_MAX)} records in this bounded page</span><span>Sorting applies to this page</span></div>}
    {paginate && pageCount > 1 && <nav className="tablepager" aria-label="Loaded record pages" data-od-id="client-pager">
      <button className="btn" data-od-id="pager-previous" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={current === 0}>← Previous page</button>
      <span className="sub mono">Page {current + 1} of {pageCount}</span>
      <button className="btn" data-od-id="pager-next" onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={current >= pageCount - 1}>Next page →</button>
    </nav>}
  </div>;
}
