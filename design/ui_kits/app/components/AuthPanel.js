/* Generated from TypeScript. Edit the paired .ts source and rebuild. */
"use strict";
var RouterAuthPanel = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // ui_kits/app/components/AuthPanel.ts
  var AuthPanel_exports = {};
  __export(AuthPanel_exports, {
    AccessStates: () => AccessStates,
    AuthPanel: () => AuthPanel
  });

  // ui_kits/app/components/Badge.ts
  function escape(value) {
    return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function Badge(label, tone = "plain", id = "") {
    const symbol = { plain: "\u25CB", good: "\u2713", warn: "\u25B3", bad: "\xD7", unknown: "?" }[tone];
    return `<span class="badge ${tone}" ${id ? `data-od-id="${escape(id)}"` : ""}><span aria-hidden="true">${symbol}</span>${escape(label)}</span>`;
  }
  function Mark() {
    return `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M7 25V7h10v8h8v10H7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M7 16h10V7m0 9 8 9" stroke="currentColor" stroke-width="1.8"/><circle cx="17" cy="16" r="3" fill="currentColor"/></svg>`;
  }

  // ui_kits/app/components/AuthPanel.ts
  function AuthPanel() {
    return `<section class="panel" data-od-id="auth-panel"><div class="brand" style="padding:0;margin-bottom:24px">${Mark()}<span>Router Console</span></div><h2>Sign in to the console</h2><p class="muted small" style="margin:8px 0 24px">Read router evidence with your assigned console role.</p><div class="notice error" role="status"><span class="symbol" aria-hidden="true">\xD7</span><div><p><strong>Identity provider unavailable</strong></p><p class="muted">New federated sign-ins are unavailable. Existing sessions retain their configured lifetime.</p></div></div><button class="btn" style="width:100%;margin-top:16px" data-provider-retry data-od-id="oidc-provider">Continue with configured provider \u2197</button><p class="small muted" style="margin:8px 0 20px">OpenID Connect over OAuth 2.0 \xB7 provider-neutral</p><details open><summary style="min-height:44px;cursor:pointer" data-od-id="local-recovery-toggle">Use local recovery</summary><form class="auth-form" data-recovery-form novalidate><fieldset><legend>Provisioned recovery account</legend><label class="control-label">Local account<input class="input" name="account" autocomplete="username" required aria-describedby="recovery-hint" placeholder="Recovery account name"></label><label class="control-label">Password<input class="input" name="password" type="password" autocomplete="current-password" required aria-describedby="recovery-hint"></label><p id="recovery-hint" class="small muted">Use the account provisioned through the trusted appliance setup. No universal default credential.</p><button class="btn primary" type="submit" data-od-id="local-sign-in">Validate example form</button></fieldset><p data-recovery-result class="auth-result" role="status" hidden></p></form></details><p class="small muted" style="margin-top:20px">Design-system example only. Credentials are never transmitted or stored. Console sign-in does not grant device firewall access.</p></section>`;
  }
  function AccessStates() {
    return `<div class="state-stack" data-od-id="access-error-states"><section class="panel"><div class="sectionhead"><h2>Session expired</h2>${Badge("Reauthenticate", "warn")}</div><p class="small muted">Your session ended at 09:30 UTC. The investigation is retained; signing in restores permitted access.</p><a href="#auth-panel" class="btn" style="margin-top:16px">Return to sign-in</a></section><section class="panel"><div class="sectionhead"><h2>Access denied</h2>${Badge("Permission limited", "unknown")}</div><p class="small muted">Viewer can read summaries. Flow metadata and exports require an explicitly assigned permission.</p><button class="btn" data-export-denied style="margin-top:16px">Review export permission</button></section><section class="panel"><h2>Observation service unavailable</h2><p class="small muted" style="margin-top:10px">Last snapshot 09:14 UTC. Routing continues independently of this console. A refresh cannot make old observations current.</p><button class="btn" style="margin-top:16px" data-refresh-evidence>Check for new observations</button><p class="small muted" data-refresh-result role="status" style="margin-top:12px"></p></section></div>`;
  }
  return __toCommonJS(AuthPanel_exports);
})();
