import { useState } from 'react';
import { useAuth } from '../auth';
import type { AuthMethods, Session } from '../types';
import { demoEnabled, request, sameOriginPath, validateSession } from '../lib/api';
import { useResource } from '../lib/hooks';
import { Badge } from './Badge';
import { BrandMark } from './BrandMark';

export function AuthPanel() {
  const auth = useAuth();
  const methods = useResource<AuthMethods>('/auth/methods');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const invalidLogin = params.get('error') === 'invalid_login';
  const providerFailed = /oidc|provider/.test(params.get('error') || '');
  const provider = methods.data?.oidc;
  const loginPath = sameOriginPath(provider?.login_url);
  return <main className="auth-main" id="main-content"><section className="panel auth-panel" data-od-id="login"><div className="auth-brand"><BrandMark size={32} /><span>Router Console</span></div><h1 tabIndex={-1}>Sign in to the console</h1><p className="muted">Investigate router observations and installed policy.</p>
    {demoEnabled && <p className="notice"><Badge tone="warn">Explicit demo mode</Badge> Credentials here are only an example interaction. Use arbitrary demonstration values.</p>}
    {auth.expired && <p className="notice" role="alert">Session expired. Sign in again to continue your investigation.</p>}
    {invalidLogin && <p className="notice error" role="alert">The sign-in response could not be verified. Try again or use local recovery.</p>}
    {providerFailed && <p className="notice error" role="alert">Identity provider unavailable. Use a provisioned local recovery account.</p>}
    {methods.loading && <p role="status">Loading configured sign-in methods…</p>}
    {methods.error && <div className="notice error" role="alert"><p>{methods.error.message}</p><button className="btn" onClick={methods.reload}>Retry sign-in methods</button></div>}
    {provider?.enabled && loginPath && !demoEnabled ? <a className="btn primary" href={loginPath} data-od-id="oidc-login">Continue with {provider.name || 'configured identity provider'}</a> : provider && <p className="notice"><Badge tone="unknown">Identity provider unavailable</Badge><span>{provider.enabled && !loginPath ? 'The configured login URL is not a valid same-origin path.' : 'Federated sign-in is currently unavailable.'}</span></p>}
    {methods.data?.local && <form className="auth-form" onSubmit={async event => {
      event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
      const username = String(data.get('username') || '').trim(); const password = String(data.get('password') || '');
      if (!username || !password) { setError('Enter your local username and password.'); return; }
      setBusy(true); setError('');
      try { const session = validateSession(await request<Session>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })); form.reset(); auth.accept(session); } catch (e) { setError(e instanceof Error ? e.message : 'Sign-in failed.'); } finally { setBusy(false); }
    }}><fieldset disabled={busy}><legend>Local access / recovery</legend><p className="small muted">Use the account provisioned through the appliance’s trusted setup.</p><label className="control-label"><span>Username</span><input className="input" name="username" autoComplete="username" required maxLength={200} aria-describedby={error ? 'login-error' : undefined} /></label><label className="control-label"><span>Password</span><input className="input" type="password" name="password" autoComplete="current-password" required maxLength={1024} aria-describedby={error ? 'login-error' : undefined} /></label>{error && <p className="notice error" id="login-error" role="alert">{error}</p>}<button className="btn primary" type="submit">{busy ? 'Signing in…' : 'Sign in locally'}</button></fieldset></form>}
    {methods.data && !methods.data.local && <p className="notice">Local recovery is not enabled. Use the appliance’s trusted setup path.</p>}
    <p className="auth-boundary small muted">Console access does not grant a device firewall access.</p>
  </section></main>;
}
