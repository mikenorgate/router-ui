import { Children, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { useFilters } from '../lib/hooks';
import type { Resource } from '../lib/hooks';
import { text } from '../lib/format';
import { Badge } from './Badge';

export function PageHeader({ title, description, children, parent }: { title: string; description: string; children?: ReactNode; parent?: string }) {
  const { href } = useFilters();
  return <header className="pagehead" data-od-id="page-header"><div>
    <nav className="breadcrumb" aria-label="Breadcrumb"><Link to={href('/overview')}>Console</Link><span aria-hidden="true">/</span>{parent && <><Link to={href(`/${parent.toLowerCase()}`)}>{parent}</Link><span aria-hidden="true">/</span></>}<span>{title}</span></nav>
    <h1 tabIndex={-1} data-od-id="page-title">{title}</h1><p>{description}</p>
  </div>{children && <div className="toolbar">{children}</div>}</header>;
}
export function Panel({ title, description, children, action, id }: { title: string; description?: string; children: ReactNode; action?: ReactNode; id?: string }) {
  return <section className="panel" data-od-id={id || title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}><div className="sectionhead"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>{children}</section>;
}
export function Empty({ title = 'No observations', detail = 'No records are available for this view.', action }: { title?: string; detail?: string; action?: ReactNode }) {
  return <div className="empty" role="status"><h3>{title}</h3><p>{detail}</p>{action}</div>;
}
export function Permission({ detail = 'Detailed traffic and exports require Operator or Administrator access.' }: { detail?: string }) {
  return <div className="notice" data-od-id="permission-limited"><Badge tone="unknown">Permission limited</Badge><p>{detail}</p></div>;
}
export function RequestState<T>({ resource, children }: { resource: Resource<T>; children: (data: T) => ReactNode }) {
  if (resource.loading && resource.data === undefined) return <div className="loading" role="status"><span className="loading-bar" />Loading router observations…</div>;
  if (resource.error && resource.data === undefined) {
    const denied = resource.error instanceof ApiError && resource.error.status === 403;
    return <div className="notice error" role="alert" data-od-id="request-error"><h2>{denied ? 'Access denied' : 'Unable to load observations'}</h2><p>{resource.error.message}</p>{denied ? <Permission detail="The current session does not have permission for this request." /> : <button className="btn" onClick={resource.reload}>Retry request</button>}</div>;
  }
  return resource.data !== undefined ? (
    <>
      {resource.error && <div className="notice error" role="alert" style={{ marginBottom: '16px' }}><p>Background refresh failed: {resource.error.message}</p></div>}
      {children(resource.data)}
    </>
  ) : <Empty />;
}
export function Fields({ items }: { items: [string, ReactNode][] }) {
  return <dl className="keylist">{items.map(([label, value]) => <div className="field-pair" key={label}><dt>{label}</dt><dd>{value == null || value === '' ? 'Unavailable' : value}</dd></div>)}</dl>;
}
export function SearchFilter({ value, onChange, label = 'Search', hint }: { value: string; onChange: (value: string) => void; label?: string; hint?: string }) {
  return <form className="search-filter" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); onChange(String(form.get('q') || '').slice(0, 128)); }}>
    <label className="control-label"><span>{label}</span><input key={value} className="input" type="search" name="q" defaultValue={value} maxLength={128} placeholder={hint} /></label><button className="btn" type="submit">Search</button>
  </form>;
}
export function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return <label className="control-label"><span>{label}</span><select className="input" value={value} onChange={event => onChange(event.target.value)}>{options.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>;
}
export function Tabs({ items, selected, onSelect }: { items: string[]; selected: string; onSelect: (tab: string) => void }) {
  return <div className="tabs" role="tablist" aria-label="Device details">{items.map((tab, index) => <button key={tab} className="tab" id={`tab-${tab}`} aria-controls={`panel-${selected}`} role="tab" aria-selected={selected === tab} tabIndex={selected === tab ? 0 : -1} onClick={() => onSelect(tab)} onKeyDown={event => {
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : offset ? (index + offset + items.length) % items.length : null;
    if (next !== null) { event.preventDefault(); const target = items[next]!; onSelect(target); document.getElementById(`tab-${target}`)?.focus(); }
  }}>{tab[0]!.toUpperCase() + tab.slice(1)}</button>)}</div>;
}
export function RecordList({ records, empty = 'No records observed' }: { records?: Record<string, unknown>[]; empty?: string }) {
  if (!records?.length) return <Empty title={empty} />;
  return <div className="record-list">{records.slice(0, 128).map((record, index) => <article key={index} data-od-id={`record-${index}`}><Fields items={Object.entries(record).map(([key, value]) => [key.replaceAll('_', ' '), <span className={/bytes|address|cidr|gateway|destination|sequence/.test(key) ? 'mono' : ''}>{text(value)}</span>])} /></article>)}</div>;
}
export function Stack({ children }: { children: ReactNode }) { return <div className="stack">{Children.toArray(children)}</div>; }
