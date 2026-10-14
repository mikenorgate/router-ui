import { useState } from 'react';
import { useAuth } from '../auth';
import { query, request } from '../lib/api';
import { useFilters } from '../lib/hooks';
export function ExportButton({ deviceId, kind = 'flows' }: { deviceId?: string | null; kind?: 'flows' | 'dns' }) {
  const { params } = useFilters();
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const viewer = session?.user.role === 'viewer';
  return <div className="export-control"><button className="btn" disabled={busy || viewer} onClick={async () => { setBusy(true); setMessage(''); try {
    const data = await request<unknown>(query('/export', { ...Object.fromEntries([...params.entries()].filter(([key]) => ['q','from','to','range','verdict','protocol','family','translation','state','rcode','resolver'].includes(key))), kind, device_id: deviceId }));
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'router-console-' + kind + '.json'; document.body.append(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Downloaded up to 500 matching ' + (kind === 'dns' ? 'DNS observations' : 'flow records') + ' in the selected window.');
  } catch (e) { setMessage(e instanceof Error ? e.message : 'Export failed.'); } finally { setBusy(false); } }}> {busy ? 'Exporting…' : kind === 'dns' ? 'Export DNS' : 'Export flows'}</button>{viewer && <p className="small muted">Export requires Operator or Administrator.</p>}{message && <p className="notice" role="status">{message}</p>}</div>;
}
