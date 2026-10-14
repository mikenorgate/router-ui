import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { demoEnabled } from '../lib/api';
import { useFilters, useRouteFocus } from '../lib/hooks';
import { Badge } from './Badge';
import { Sidebar } from './Sidebar';

function preference(key: string, fallback: string): string { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } }
export function AppShell({ children }: { children: ReactNode }) {
  const filters = useFilters();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => preference('console-theme', window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const [density, setDensity] = useState(() => preference('console-density', 'comfortable'));
  useRouteFocus();
  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem('console-theme', theme); } catch { /* Preferences are optional. */ } }, [theme]);
  useEffect(() => { document.documentElement.dataset.density = density; try { localStorage.setItem('console-density', density); } catch { /* Preferences are optional. */ } }, [density]);
  return <><a className="skip" href="#main-content">Skip to content</a>{demoEnabled && <div className="demo-banner" role="status" data-od-id="demo-banner"><Badge tone="warn">Explicit demo mode</Badge><span>Fictional observations · documentation addresses · no router API requests</span></div>}<div className="shell"><Sidebar theme={theme} onTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} /><div className="content"><header className="topbar" data-od-id="global-controls"><form className="global-search" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); const q = String(data.get('search') || '').trim().slice(0, 128); if (q) navigate(filters.href('/search', { q })); }}><label className="sr" htmlFor="global-search">Search devices, traffic, rules and events</label><input id="global-search" className="input" name="search" type="search" maxLength={128} placeholder="Search name, address, rule…" /><button className="btn" type="submit">Search</button></form><div className="toolbar"><label className="control-label inline"><span>Interval</span><select className="input" value={filters.params.get('range') || '1h'} onChange={event => { filters.set('range', event.target.value); }}><option value="15m">Last 15 minutes</option><option value="1h">Last hour</option><option value="24h">Last 24 hours</option></select></label><label className="control-label inline density-control"><span>Density</span><select className="input" value={density} onChange={event => setDensity(event.target.value)}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label></div></header><main className="main" id="main-content">{filters.params.has('from') && <div className="notice interval-notice"><span>Selected observation interval: <span className="mono">{filters.params.get('from')} → {filters.params.get('to') || 'end unavailable'}</span></span><button className="btn text" onClick={() => filters.set('range', filters.params.get('range') || '1h')}>Clear selected interval</button></div>}{children}</main><footer className="app-footer">Router-local evidence · Console access is separate from device network access.</footer></div></div></>;
}
