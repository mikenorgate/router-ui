import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { useAuth } from './auth';
import { demoEnabled } from './lib/api';
import { useFilters } from './lib/hooks';
import { AppShell } from './components/AppShell';
import { AuthPanel } from './components/AuthPanel';
import { Empty, PageHeader } from './components/UI';
import { OverviewPage } from './pages/OverviewPage';
import { DevicesPage } from './pages/DevicesPage';
import { DeviceDetailPage } from './pages/DeviceDetailPage';
import { TrafficPage } from './pages/TrafficPage';
import { NetworkPage } from './pages/NetworkPage';
import { FirewallPage } from './pages/FirewallPage';
import { EventsPage } from './pages/EventsPage';
import { SystemPage } from './pages/SystemPage';
import { SearchPage } from './pages/SearchPage';
export function App() {
  const auth = useAuth();
  const { href } = useFilters();
  if (auth.loading) return <main className="auth-main"><div role="status">Connecting to the local console…</div></main>;
  if (auth.error) return <main className="auth-main"><section className="panel" role="alert"><h1>Cannot connect to the console</h1><p>{auth.error.message}</p><button className="btn" onClick={auth.retry}>Retry connection</button><p className="callout">No observations can be loaded until the router API is available.</p></section></main>;
  if (!auth.session) return <AuthPanel />;
  return <AppShell>{auth.session.mode === 'fixture' && !demoEnabled && <p className="notice">Backend fixture mode · These observations are supplied by the server.</p>}<Routes>
    <Route path="/" element={<Navigate to={href('/overview')} replace />} />
    <Route path="/overview" element={<OverviewPage />} />
    <Route path="/devices" element={<DevicesPage />} />
    <Route path="/devices/:id" element={<DeviceDetailPage />} />
    <Route path="/traffic" element={<TrafficPage />} />
    <Route path="/network" element={<NetworkPage />} />
    <Route path="/firewall" element={<FirewallPage />} />
    <Route path="/events" element={<EventsPage />} />
    <Route path="/system" element={<SystemPage />} />
    <Route path="/search" element={<SearchPage />} />
    <Route path="/login" element={<Navigate to={href('/overview')} replace />} />
    <Route path="*" element={<><PageHeader title="Page not found" description="This path is not part of the console." /><Empty title="Return to the observatory" action={<Link className="btn" to={href('/overview')}>Open overview</Link>} /></>} />
  </Routes></AppShell>;
}
