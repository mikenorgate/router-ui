import { useState } from 'react';
import { useAuth } from '../auth';
import { query, request } from '../lib/api';
export function ExportButton({ deviceId }: { deviceId?: string | null }) {
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const viewer = session?.user.role === 'viewer';
  return <div className="export-control"><button className="btn" disabled={busy || viewer} onClick={async () => { setBusy(true); setMessage(''); try {
    const data = await request<unknown>(query('/export', { kind: 'flows', device_id: deviceId }));
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'router-console-flows.json'; document.body.append(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Flow export downloaded. Export contains the server-authorized scope; current client filters do not change it.');
  } catch (e) { setMessage(e instanceof Error ? e.message : 'Export failed.'); } finally { setBusy(false); } }}> {busy ? 'Exporting…' : 'Export flows'}</button>{viewer && <p className="small muted">Export requires Operator or Administrator.</p>}{message && <p className="notice" role="status">{message}</p>}</div>;
}
