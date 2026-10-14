// Filter controls whose semantics are server-side: each change re-queries the
// router and the returned page is the filtered result, not a client-side view
// of it. Changing a filter resets pagination (handled by useFilters.set).
import { FilterSelect, SearchFilter } from './UI';

export interface ServerFilter {
  key: string;
  label: string;
  options: [string, string][];
}

export function ServerFilterBar({ filters, values, onChange, onClear, searchLabel, searchHint }: {
  filters: ServerFilter[];
  values: URLSearchParams;
  onChange: (key: string, value: string) => void;
  onClear: () => void;
  searchLabel?: string;
  searchHint?: string;
}) {
  return <div data-od-id="server-filter-bar">
    <div className="filterbar">
      {searchLabel !== undefined && <SearchFilter label={searchLabel} hint={searchHint} value={values.get('q') || ''} onChange={value => onChange('q', value)} />}
      {filters.map(filter => <FilterSelect
        key={filter.key}
        label={filter.label}
        value={values.get(filter.key) || ''}
        onChange={value => onChange(filter.key, value)}
        options={filter.options}
      />)}
      <button className="btn text" onClick={onClear}>Clear filters</button>
    </div>
    <p className="filter-note muted small">Filters apply on the router before pagination; the page below is the filtered result set, bounded per request.</p>
  </div>;
}
