import { useState } from 'react';
import { request } from '../lib/api';
import { useAuth } from '../auth';
import { Permission } from './UI';
export function AnnotationEditor({ deviceId, alias = '', note = '', onSaved }: { deviceId: string; alias?: string; note?: string; onSaved: () => void }) {
  const { session } = useAuth();
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aliasValue, setAliasValue] = useState(alias);
  const [noteValue, setNoteValue] = useState(note);
  if (session?.user.role === 'viewer') return <><Permission detail="Editing console aliases and notes requires Operator or Administrator access." /><dl className="keylist"><dt>Console alias</dt><dd>{alias || 'Not set'}</dd><dt>Console note</dt><dd className="note-text">{note || 'Not set'}</dd></dl></>;
  return <form className="annotation-form" onSubmit={async event => { event.preventDefault(); setBusy(true); setError(''); setSaved(false); try { await request(`/devices/${encodeURIComponent(deviceId)}/annotation`, { method: 'POST', body: JSON.stringify({ alias: aliasValue.trim(), note: noteValue }) }); setSaved(true); onSaved(); } catch (e) { setError(e instanceof Error ? e.message : 'Annotation was not saved.'); } finally { setBusy(false); } }}><p className="small muted">Console-owned metadata. Saving does not rename DHCP/DNS records or change router policy.</p><label className="control-label"><span>Console alias</span><input className="input" value={aliasValue} onChange={e => { setAliasValue(e.target.value); setSaved(false); }} maxLength={128} disabled={busy} /></label><label className="control-label"><span>Console note</span><textarea className="input" value={noteValue} onChange={e => { setNoteValue(e.target.value); setSaved(false); }} rows={4} maxLength={2048} disabled={busy} /></label>{error && <p className="notice error" role="alert">{error}</p>}{saved && <p role="status">Annotation saved.</p>}<button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save annotation'}</button></form>;
}
