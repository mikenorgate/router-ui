import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth';
import { request } from '../lib/api';
import { useFilters } from '../lib/hooks';
import { Brand } from './Brand';

const paths: Record<string, string> = {
  Overview: 'M3 3h6v6H3zm12 0h6v6h-6zM3 15h6v6H3zm12 0h6v6h-6z',
  Devices: 'M4 4h16v12H4zM8 20h8m-4-4v4',
  Traffic: 'M3 8h18m-5-4 5 4-5 4M21 16H3m5-4-5 4 5 4',
  Network: 'M12 3v6m0 6v6M3 12h6m6 0h6M9 9h6v6H9z',
  Firewall: 'M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6z',
  Events: 'M5 4h14v17H5zM8 9h8M8 13h8M8 17h5',
  System: 'M4 6h16M4 12h16M4 18h16M9 3v6m7 0v6M8 15v6',
};
export function Sidebar({ theme, onTheme }: { theme: string; onTheme: () => void }) {
  const { href, location } = useFilters();
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setOpen(false); }, [location.pathname]);
  return <aside className="sidebar" data-od-id="sidebar"><NavLink className="brand" to={href('/overview')} aria-label="Lanrith console"><Brand id="sidebar-wordmark" /><span className="brand-caption">console</span></NavLink>
    <button className="btn mobile-nav-toggle" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="console-navigation">{open ? 'Close navigation' : 'Open navigation'}</button>
    <nav id="console-navigation" className={`navlinks ${open ? 'mobile-open' : ''}`} aria-label="Main navigation">{Object.entries(paths).map(([label, path]) => <NavLink key={label} className={({ isActive }) => `navitem ${isActive ? 'active' : ''}`} to={href(`/${label.toLowerCase()}`)} data-od-id={`nav-${label.toLowerCase()}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg><span>{label}</span></NavLink>)}</nav>
    <div className="sidebar-bottom"><div className="nav-meta"><span className="eyebrow">Evidence boundary</span><p>Router configuration is read-only.</p></div><button className="btn" onClick={onTheme}>{theme === 'dark' ? 'Use light theme' : 'Use dark theme'}</button><div className="account"><strong>{auth.session?.user.name}</strong><span>{auth.session?.user.role === 'admin' ? 'Administrator' : auth.session?.user.role === 'operator' ? 'Operator' : 'Viewer'}</span></div><button className="btn text" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await request('/auth/logout', { method: 'POST' }); auth.accept(null); } catch (e) { setError(e instanceof Error ? e.message : 'Sign-out failed.'); } finally { setBusy(false); } }}>{busy ? 'Signing out…' : 'Sign out'}</button>{error && <p className="error-text" role="alert">{error}</p>}</div>
  </aside>;
}
