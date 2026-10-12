/* Generated from TypeScript. Edit the paired .ts source and rebuild. */
"use strict";
var RouterApp = (() => {
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

  // ui_kits/app/components/App.ts
  var App_exports = {};
  __export(App_exports, {
    App: () => App,
    bindInteractions: () => bindInteractions,
    exampleBanner: () => exampleBanner,
    mount: () => mount,
    reference: () => reference
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
  function Icon(name) {
    const p = { overview: "M3 3h6v6H3zm12 0h6v6h-6zM3 15h6v6H3zm12 0h6v6h-6z", devices: "M4 4h16v12H4zM8 20h8m-4-4v4", traffic: "M3 8h18m-5-4 5 4-5 4M21 16H3m5-4-5 4 5 4", network: "M12 3v6m0 6v6M3 12h6m6 0h6M9 9h6v6H9z", firewall: "M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6z", events: "M5 4h14v17H5zM8 9h8M8 13h8M8 17h5", system: "M4 6h16M4 12h16M4 18h16M9 3v6m7 0v6M8 15v6" };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${p[name] || p.devices}"/></svg>`;
  }

  // ui_kits/app/components/Sidebar.ts
  function Sidebar(active, base = "") {
    const paths = { Overview: "overview.html", Devices: "device-firewall.html", Traffic: "flow-inspector.html", Firewall: "device-firewall.html", System: "access-states.html" };
    return `<aside class="sidebar" data-od-id="sidebar"><a class="brand" href="${base}index.html" data-od-id="brand">${Mark()}<span>Router Console<span class="brand-caption" style="display:block">Design-system examples</span></span></a><details open><summary data-od-id="mobile-nav-toggle">Navigation <span class="muted">\u2304</span></summary><nav class="navlinks" aria-label="Console examples">${["Overview", "Devices", "Traffic", "Network", "Firewall", "Events", "System"].map((n) => paths[n] ? `<a class="navitem ${n === active ? "active" : ""}" ${n === active ? 'aria-current="page"' : ""} href="${base}${paths[n]}" data-od-id="nav-${n.toLowerCase()}">${Icon(n.toLowerCase())}<span>${n}</span></a>` : `<span class="navitem disabled" title="Specified in DESIGN.md; no full module in this package">${Icon(n.toLowerCase())}<span>${n}<span class="sr">: documented section, no example screen</span></span></span>`).join("")}</nav></details><div class="sidebottom"><div class="nav-meta"><span class="eyebrow">Evidence boundary</span><p style="padding:8px 0 0">Read-only router views.<br>Fictional example records.</p></div><a class="btn text" href="${base}index.html">Component reference \u2197</a><button class="btn" data-theme-toggle data-od-id="theme-toggle">Switch to graphite</button><p>Draft system \xB7 v0.1</p></div></aside>`;
  }

  // ui_kits/app/components/Metric.ts
  function Metric(p) {
    return `<dl class="metric" data-od-id="metric-${escape(p.id)}"><dt>${escape(p.label)}</dt><dd class="value">${escape(p.value)}<span class="unit">${escape(p.unit)}</span></dd><dd class="meta"><span>${escape(p.change)}</span><span class="muted" style="font-size:0.9em">${escape(p.age)}</span></dd></dl>`;
  }

  // ui_kits/app/components/Chart.ts
  function Chart(kind = "throughput", range = "15") {
    const latency = kind === "latency", historical = range === "60", duration = historical ? 60 : 15;
    const id = `chart-${kind}-${range}`, start = historical ? "08:30" : "09:15", max = latency ? 40 : 160;
    const download = historical ? [20, 24, 22, 32, 38, 42, 58, 74, 78, 86, 112, 148, 136, 119, 98, 92, 82, 76, 79, 68, 64, 62, 74, 71, 69, 66, 63, null, 61, 60, 58.2] : [32, 36, 42, 39, 43, 54, 61, 57, 82, 106, 148, 139, 133, 110, 98, 108, 92, 88, null, null, null, 73, 80, 74, 68, 63, 70, 64, 60, 62, 58.2];
    const measured = latency ? download.map((v) => v === null ? null : Math.round(21 + v * 0.12)) : download;
    measured[0] = latency ? 24 : download[0];
    measured[historical ? 11 : 10] = latency ? 39 : 148;
    measured[30] = latency ? 24 : 58.2;
    const secondary = download.map((v, i) => v === null ? null : latency ? 20 + i % 4 : +(v * 0.23 + 6.6).toFixed(1));
    secondary[0] = latency ? 21 : 14;
    secondary[30] = latency ? 22 : 16;
    const x = (i) => 54 + i * 726 / 30, y = (v) => 145 - v / max * 110;
    const segments = (values) => {
      const groups = [];
      let current = [];
      values.forEach((v, i) => {
        if (v === null) {
          if (current.length) groups.push(current);
          current = [];
        } else current.push({ x: x(i), y: y(v) });
      });
      if (current.length) groups.push(current);
      return groups;
    };
    const line = (values) => segments(values).map((group) => group.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("")).join(" ");
    const area = segments(measured).map((g) => `M${g[0].x} 145L${g.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("L")}L${g.at(-1).x} 145Z`).join(" ");
    const eventMinute = historical ? 50 : 5, eventX = 54 + eventMinute / duration * 726, gapX = 54 + (historical ? 54 : 9) / duration * 726, gapWidth = 726 / duration;
    const labels = historical ? ["08:30", "08:50", "09:10", "09:30"] : ["09:15", "09:20", "09:25", "09:30"];
    return `<section data-od-id="${id}"><div class="chart-heading"><h3>${latency ? "Gateway probe latency" : "WAN throughput"}</h3><div class="legend"><span>${latency ? "Measured latency" : "Download"}</span><span>${latency ? "Previous interval" : "Upload"}</span></div></div><div class="chart-wrap"><svg viewBox="0 0 820 190" role="img" aria-labelledby="${id}-title ${id}-desc"><title id="${id}-title">${latency ? "Latency in milliseconds" : "Traffic in megabits per second"} \xB7 ${start}\u201309:30 UTC</title><desc id="${id}-desc">Fictional samples. Peak ${historical ? "08:52" : "09:20"}, revision r42 recorded at 09:20, and missing samples 09:24\u201309:25. A data table follows.</desc>${[35, 90, 145].map((v) => `<line x1="54" x2="780" y1="${v}" y2="${v}" class="chart-grid"/>`).join("")}<defs><pattern id="${id}-gap" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="var(--unknown-soft)"/><path d="M0 6L6 0" stroke="var(--control-border)" stroke-width="1"/></pattern></defs><path d="${area}" class="chart-fill"/><rect x="${gapX}" y="24" width="${gapWidth}" height="121" fill="url(#${id}-gap)"/><path d="${line(measured)}" class="chart-line"/><path d="${line(secondary)}" class="chart-secondary"/><line x1="${eventX}" x2="${eventX}" y1="24" y2="145" class="chart-event"/><text x="${eventX + 7}" y="18" class="chart-label">config r42</text><text x="3" y="39" class="chart-label">${max}</text><text x="8" y="94" class="chart-label">${max / 2}</text><text x="17" y="149" class="chart-label">0</text>${labels.map((label, i) => `<text x="${[54, 285, 515, 728][i]}" y="174" class="chart-label">${label}</text>`).join("")}</svg></div><div class="chart-note"><span>${latency ? "Router-originated probes \xB7 not device reachability" : `Interface counters \xB7 ${historical ? "2min rollup from 30s samples" : "sampled at 30s"} \xB7 not per-device totals`}</span><span>Gap: 09:24\u201309:25 UTC</span></div><details class="data-summary"><summary>View chart values and evidence</summary><table class="table"><caption>Fictional ${duration}-minute fixture; event correlation does not establish cause.</caption><thead><tr><th>Time (UTC)</th><th>${latency ? "Latency (ms)" : "Download (Mbit/s)"}</th><th>${latency ? "Probe source" : "Upload (Mbit/s)"}</th><th>Evidence</th></tr></thead><tbody><tr><td class="mono">${start}</td><td class="mono">${measured[0]}</td><td class="mono">${latency ? "Router WAN" : secondary[0]}</td><td>${historical ? "Rolled-up" : "Sampled"}</td></tr><tr><td class="mono">${historical ? "08:52" : "09:20"}</td><td class="mono">${latency ? "39" : "148"}</td><td class="mono">${latency ? "Router WAN" : secondary[historical ? 11 : 10]}</td><td>${historical ? "Fixture peak" : "Revision r42 recorded"}</td></tr>${historical ? `<tr><td class="mono">09:20</td><td class="mono">${measured[25]}</td><td class="mono">${latency ? "Router WAN" : secondary[25]}</td><td>Revision r42 recorded</td></tr>` : ""}<tr><td class="mono">09:24\u201309:25</td><td>\u2014</td><td>\u2014</td><td>No samples; collector gap</td></tr><tr><td class="mono">09:30</td><td class="mono">${latency ? "24" : "58.2"}</td><td class="mono">${latency ? "Router WAN" : "16"}</td><td>${historical ? "Rolled-up" : "Sampled"}</td></tr></tbody></table></details></section>`;
  }

  // ui_kits/app/components/PolicyTable.ts
  var policies = [
    { id: "POL-010", name: "Permit established replies", effect: "Allow", tone: "good", scope: "Router baseline", source: "Image baseline", version: "image 1.4.0 / rev 8", expiry: "No expiry", observed: "09:29:54 UTC", applicable: "Connection-state dependent", matches: "Shared rule counter: 1,284", conditions: "IPv4 / IPv6 \xB7 established, related", producer: "Signed image policy manifest" },
    { id: "POL-042", name: "Restrict inter-segment traffic", effect: "Deny", tone: "bad", scope: "Inherited \xB7 Example segment A", source: "Configuration", version: "config r42", expiry: "No expiry", observed: "09:29:54 UTC", applicable: "Applicable \xB7 IPv4", matches: "Observed match \xB7 09:27:18", conditions: "IPv4 \xB7 segment A \u2192 segment B \xB7 TCP/443", producer: "Declarative config compiler" },
    { id: "POL-108", name: "Time-limited service grant", effect: "Allow", tone: "good", scope: "Device-specific exception", source: "Runtime producer", version: "grant v3 / revision r42", expiry: "Expired 09:24 UTC", observed: "09:20:30 UTC \xB7 stale", applicable: "Applicability unknown after expiry", matches: "No observations", conditions: "IPv4 \xB7 192.0.2.24 \u2192 198.51.100.60 \xB7 TCP/8443", producer: "Local grant receiver \xB7 issuer demo-service" },
    { id: "POL-211", name: "IPv6 destination set", effect: "Unknown", tone: "unknown", scope: "Inherited \xB7 Example group", source: "Origin unavailable", version: "Installed revision r42", expiry: "Lifetime unavailable", observed: "09:29:54 UTC", applicable: "Partial \xB7 set expansion unsupported", matches: "Unobserved", conditions: "IPv6 \xB7 set reference @example-destinations", producer: "Producer metadata unavailable" }
  ];
  function PolicyTable(rows = policies) {
    return `<div data-od-id="policy-table"><label class="mobile-sort control-label"><span>Rule order</span><select class="input" data-policy-order><option value="asc">Rule ID \xB7 ascending</option><option value="desc">Rule ID \xB7 descending</option></select></label><table class="table responsive"><caption class="sr">Fictional policy records. Installed, applicable and observed match are distinct evidence states.</caption><thead><tr><th aria-sort="none"><button class="btn text" data-sort-policy>Rule / source \u2195</button></th><th>Effect &amp; scope</th><th>Applicability</th><th>Match evidence</th><th><span class="sr">Inspect</span></th></tr></thead><tbody data-policy-rows>${policyRows(rows)}</tbody></table><div class="tablefoot"><span data-policy-count>${rows.length} of 4 example rules \xB7 bounded snapshot</span><span class="mono">revision r42</span></div></div>`;
  }
  function policyRows(rows) {
    return rows.map((p) => `<tr data-rule="${p.id}" data-od-id="rule-${p.id.toLowerCase()}"><td data-label="Rule / source"><span><strong class="mono no-wrap-desktop">${p.id}</strong><span class="sub no-wrap-desktop">${escape(p.name)}</span><span class="sub muted no-wrap-desktop" style="margin-top:2px;">${escape(p.source)} \xB7 ${escape(p.version)}</span></span></td><td data-label="Effect / scope"><span>${Badge(p.effect, p.tone)}<span class="sub no-wrap-desktop">${escape(p.scope)}</span></span></td><td data-label="Applicability"><span>${p.id === "POL-108" ? Badge("Installed \xB7 stale", "warn") : Badge("Installed", "plain")}<span class="sub no-wrap-desktop">${escape(p.applicable)}</span></span></td><td data-label="Evidence"><span>${p.id === "POL-042" ? Badge("Observed match", "good") : p.id === "POL-010" ? Badge("Shared counter", "plain") : Badge(p.matches, "unknown")}<span class="sub no-wrap-desktop ${p.id === "POL-042" || p.id === "POL-010" ? "mono" : ""}">${escape(p.matches)}</span></span></td><td data-label="Details" style="text-align:right"><button class="btn text row-inspect" data-inspect="${p.id}" aria-label="Inspect rule ${p.id}">Inspect \u2197</button></td></tr>`).join("") || '<tr><td colspan="5"><div class="empty"><strong>No matching rules</strong><p>Try a rule ID, source or effect.</p><button class="btn" data-clear-filter>Clear filters</button></div></td></tr>';
  }

  // ui_kits/app/components/Inspector.ts
  function RuleDetail(p) {
    return `<div class="badge-row" style="margin-bottom:20px">${Badge(p.effect, p.tone)}${Badge(p.id === "POL-108" ? "Installed \xB7 stale" : "Installed")}${Badge(p.id === "POL-042" ? "Observed match" : "Match evidence qualified", "unknown")}</div><div class="two"><dl class="keylist"><dt>Rule</dt><dd class="mono">${p.id}</dd><dt>Conditions</dt><dd>${escape(p.conditions)}</dd><dt>Inherited scope</dt><dd>${escape(p.scope)}</dd><dt>Version</dt><dd class="mono">${escape(p.version)}</dd></dl><dl class="keylist"><dt>Lifetime</dt><dd>${escape(p.expiry)}</dd><dt>Observed snapshot</dt><dd class="mono">${escape(p.observed)}</dd><dt>Applicable</dt><dd>${escape(p.applicable)}</dd><dt>Match evidence</dt><dd>${escape(p.matches)}</dd></dl></div><h3 style="margin:28px 0 12px">Policy provenance</h3><ol class="chain"><li><p>${escape(p.source)}</p><small>${escape(p.producer)}</small></li><li><p>${escape(p.version)}</p><small>${p.id === "POL-108" ? "Historical install receipt; expiry passed. Removal is not established." : "Installed in observed snapshot \xB7 r42"}</small></li><li><p>${escape(p.scope)}</p><small>${escape(p.conditions)}</small></li><li><p>${escape(p.matches)}</p><small>${p.id === "POL-010" ? "Counter belongs to the whole rule; no device attribution." : "No further application-connectivity evidence."}</small></li></ol><p class="callout">${p.id === "POL-211" ? "Origin unavailable. The router snapshot does not include producer metadata." : p.id === "POL-108" ? "The last install observation is stale. Expiry alone does not prove removal." : "The source and observation time qualify this explanation."}</p>`;
  }
  function Inspector() {
    return `<section class="panel" data-od-id="flow-provenance-inspector"><div class="sectionhead"><div><p class="eyebrow">Recorded flow \xB7 fictional</p><h2 style="margin-top:6px">Why was this connection denied?</h2></div>${Badge("Observed denial", "bad")}</div><p class="muted small">Flow F-0081 \xB7 09:27:18 UTC \xB7 device association from lease valid at event time.</p><div class="divider"></div><dl class="keylist"><dt>Original tuple</dt><dd class="mono">192.0.2.24:52144 \u2192 198.51.100.60:443<br>TCP / IPv4</dd><dt>Translated tuple</dt><dd>None recorded. Denied before postrouting.<br><span class="muted small">No translation is inferred.</span></dd><dt>Observed verdict</dt><dd>${Badge("Deny", "bad")} <span class="mono">POL-042</span></dd><dt>Application result</dt><dd>Unknown \xB7 no application-level evidence</dd><dt>Observation point</dt><dd>Router forwarding hook \xB7 attributed verdict event</dd><dt>Evidence age</dt><dd class="mono">09:27:18 UTC \xB7 snapshot r42 at 09:29:54</dd></dl><h3 style="margin:24px 0 8px">Recorded rule path</h3><ol class="chain"><li><p><span class="mono">prerouting \u2192 route lookup</span></p><small>Destination resolved to Example segment B.</small></li><li><p><span class="mono">forward \u2192 segment-policy</span></p><small>Jump into inherited policy. Return/jump boundaries preserved.</small></li><li><p><span class="mono">POL-042</span> \xB7 Deny TCP/443</p><small>Recorded attributed match; hook processing terminated here.</small></li><li><p>Application connectivity unknown</p><small>A firewall verdict does not establish an application response.</small></li></ol><div class="toolbar" style="margin-top:20px"><button class="btn" data-inspect="POL-042">Inspect policy provenance</button><button class="btn text" data-copy="F-0081">Copy flow ID</button></div></section>`;
  }
  function InspectionDialog() {
    return `<dialog class="inspector-dialog" id="policy-dialog" aria-labelledby="policy-dialog-title"><div class="inspector-top"><h2 id="policy-dialog-title">Rule provenance</h2><button class="btn text" data-close-inspector aria-label="Close rule inspector">Close \xD7</button></div><div data-rule-detail>${RuleDetail(policies[1])}</div></dialog>`;
  }

  // ui_kits/app/components/AuthPanel.ts
  function AuthPanel() {
    return `<section class="panel" data-od-id="auth-panel"><div class="brand" style="padding:0;margin-bottom:24px">${Mark()}<span>Router Console</span></div><h2>Sign in to the console</h2><p class="muted small" style="margin:8px 0 24px">Read router evidence with your assigned console role.</p><div class="notice error" role="status"><span class="symbol" aria-hidden="true">\xD7</span><div><p><strong>Identity provider unavailable</strong></p><p class="muted">New federated sign-ins are unavailable. Existing sessions retain their configured lifetime.</p></div></div><button class="btn" style="width:100%;margin-top:16px" data-provider-retry data-od-id="oidc-provider">Continue with configured provider \u2197</button><p class="small muted" style="margin:8px 0 20px">OpenID Connect over OAuth 2.0 \xB7 provider-neutral</p><details open><summary style="min-height:44px;cursor:pointer" data-od-id="local-recovery-toggle">Use local recovery</summary><form class="auth-form" data-recovery-form novalidate><fieldset><legend>Provisioned recovery account</legend><label class="control-label">Local account<input class="input" name="account" autocomplete="username" required aria-describedby="recovery-hint" placeholder="Recovery account name"></label><label class="control-label">Password<input class="input" name="password" type="password" autocomplete="current-password" required aria-describedby="recovery-hint"></label><p id="recovery-hint" class="small muted">Use the account provisioned through the trusted appliance setup. No universal default credential.</p><button class="btn primary" type="submit" data-od-id="local-sign-in">Validate example form</button></fieldset><p data-recovery-result class="auth-result" role="status" hidden></p></form></details><p class="small muted" style="margin-top:20px">Design-system example only. Credentials are never transmitted or stored. Console sign-in does not grant device firewall access.</p></section>`;
  }
  function AccessStates() {
    return `<div class="state-stack" data-od-id="access-error-states"><section class="panel"><div class="sectionhead"><h2>Session expired</h2>${Badge("Reauthenticate", "warn")}</div><p class="small muted">Your session ended at 09:30 UTC. The investigation is retained; signing in restores permitted access.</p><a href="#auth-panel" class="btn" style="margin-top:16px">Return to sign-in</a></section><section class="panel"><div class="sectionhead"><h2>Access denied</h2>${Badge("Permission limited", "unknown")}</div><p class="small muted">Viewer can read summaries. Flow metadata and exports require an explicitly assigned permission.</p><button class="btn" data-export-denied style="margin-top:16px">Review export permission</button></section><section class="panel"><h2>Observation service unavailable</h2><p class="small muted" style="margin-top:10px">Last snapshot 09:14 UTC. Routing continues independently of this console. A refresh cannot make old observations current.</p><button class="btn" style="margin-top:16px" data-refresh-evidence>Check for new observations</button><p class="small muted" data-refresh-result role="status" style="margin-top:12px"></p></section></div>`;
  }

  // ui_kits/app/components/App.ts
  function exampleBanner() {
    return `<div class="notice" data-od-id="example-evidence-banner"><span class="symbol" aria-hidden="true">i</span><p><strong>Fictional example data.</strong> Evidence times are fixed fixture values. This package does not connect to a router.</p></div>`;
  }
  function timeSelector() {
    return `<label class="control-label"><span class="sr">Example observation interval</span><select class="input" data-time-range data-od-id="time-range"><option value="15">Last 15 minutes \xB7 fixture</option><option value="60">Last hour \xB7 fixture</option></select></label><button class="btn" data-theme-toggle data-od-id="header-theme-toggle">Graphite theme</button>`;
  }
  function metrics() {
    return `<div class="metric-strip" data-od-id="overview-metrics">${Metric({ label: "WAN download", value: "58.2", unit: "Mbit/s", change: "\u2193 12.4 vs previous interval", age: "Interface sample \xB7 09:29:30 UTC", id: "download" })}${Metric({ label: "Gateway latency", value: "24", unit: "ms", change: "+3 ms vs previous interval", age: "Router probe \xB7 09:29:30 UTC", id: "latency" })}${Metric({ label: "Observed devices", value: "12", unit: "devices", change: "2 with stale evidence", age: "Lease + neighbour sources \xB7 09:29 UTC", id: "devices" })}${Metric({ label: "Policy snapshot", value: "r42", unit: "revision", change: "Installed \xB7 09:29:54 UTC", age: "1 provenance chain incomplete", id: "snapshot" })}</div>`;
  }
  function events() {
    return `<ol class="timeline" data-od-id="events-timeline"><li><time>09:27:18</time><div><p>Inter-segment connection denied</p><p class="muted">Example device A \xB7 <span class="mono">POL-042</span> \xB7 attributed verdict</p></div></li><li><time>09:24:00</time><div><p>Service grant expiry passed</p><p class="muted">Grant v3 \xB7 removal not yet observed</p></div></li><li><time>09:20:12</time><div><p>Configuration r42 installed</p><p class="muted">Recorded change; correlation is not causation</p></div></li></ol>`;
  }
  function overview() {
    return `${exampleBanner()}${metrics()}<div class="two section"><section class="panel" data-od-id="overview-charts-1"><div class="sectionhead"><div><h2>WAN Throughput</h2><p>UTC \xB7 fictional counters</p></div>${Badge("Sampled", "unknown")}</div><div data-charts-1>${Chart()}</div></section><section class="panel" data-od-id="overview-charts-2"><div class="sectionhead"><div><h2>Gateway Latency</h2><p>UTC \xB7 aligned timeline</p></div></div><div data-charts-2>${Chart("latency")}</div></section></div><div class="split section"><section class="panel" data-od-id="overview-devices"><div class="sectionhead"><h2>Devices needing a closer look</h2><a href="device-firewall.html" class="btn text">Inspect device \u2197</a></div><table class="table responsive"><caption>Presence evidence is distinct from connectivity.</caption><thead><tr><th>Device</th><th>Presence evidence</th><th>Latest observation</th></tr></thead><tbody><tr data-od-id="device-example-a"><td data-label="Device"><span><a href="device-firewall.html"><strong>Example device A</strong></a><span class="sub mono">192.0.2.24 \xB7 2001:db8:a::24</span></span></td><td data-label="Presence">${Badge("Recently observed", "plain")}</td><td data-label="Observation"><span>Denied inter-segment flow<span class="sub mono">09:27:18 UTC</span></span></td></tr><tr data-od-id="device-example-b"><td data-label="Device"><span><strong>Example device B</strong><span class="sub mono">192.0.2.36</span></span></td><td data-label="Presence">${Badge("Stale evidence", "warn")}</td><td data-label="Observation"><span>No observations since 09:14<span class="sub">Lease valid; current reachability unknown</span></span></td></tr><tr data-od-id="device-example-c"><td data-label="Device"><span><strong>Example device C</strong><span class="sub mono">2001:db8:a::48</span></span></td><td data-label="Presence">${Badge("Unobserved", "unknown")}</td><td data-label="Observation"><span>Address association incomplete<span class="sub">No identity merge inferred</span></span></td></tr></tbody></table></section><section class="panel" data-od-id="overview-events"><div class="sectionhead"><h2>Changes in this interval</h2><span class="small muted">UTC</span></div>${events()}</section></div>`;
  }
  function firewall() {
    return `<div class="notice" data-od-id="device-policy-summary"><span class="symbol" aria-hidden="true">i</span><div><p><strong>Installed policy does not establish successful connectivity.</strong></p><p class="muted">IPv4 inter-segment TCP/443 has an observed denial. IPv6 destination-set applicability is partially unsupported.</p></div></div><section class="section" data-od-id="device-policy-rules"><div class="sectionhead"><div><h2>Applied policy and its origin</h2><p>Snapshot r42 \xB7 observed 09:29:54 UTC \xB7 4 fictional rules</p></div><label class="control-label"><span class="sr">Table density</span><select class="input" data-density><option value="comfortable">Comfortable rows</option><option value="compact">Compact rows</option></select></label></div><div class="toolbar" style="margin-bottom:16px"><label class="search-field"><span class="sr">Filter policy by ID, source, name or effect</span><input class="input" data-policy-search placeholder="Filter by rule ID, source or effect\u2026" data-od-id="policy-search"></label><label><span class="sr">Policy evidence filter</span><select class="input" data-policy-filter><option value="all">All evidence</option><option value="matched">Observed matches</option><option value="unknown">Unknown or stale</option></select></label></div>${PolicyTable()}</section><div class="two section"><section class="panel" data-od-id="rule-evidence-legend"><h2>Read the evidence separately</h2><dl class="keylist"><dt>Installed</dt><dd>Present in the observed firewall revision.</dd><dt>Applicable</dt><dd>Scope and supported conditions cover the device or tuple.</dd><dt>Observed match</dt><dd>Attributed traffic demonstrates a match.</dd><dt>Shared counter</dt><dd>Whole-rule counter. No per-device total is inferred.</dd></dl></section><section class="panel" data-od-id="simulation-example"><h2>Explain access \xB7 local example</h2><p class="muted small" style="margin:8px 0 16px">A limited fixture illustrates outcome language. This is not a general policy evaluator.</p><form class="simulation" data-simulation><div class="controls"><label class="control-label">Destination<select class="input" name="destination"><option value="segment">Example segment B</option><option value="service">Example service</option></select></label><label class="control-label">Protocol / port<select class="input" name="port"><option value="443">TCP / 443</option><option value="8443">TCP / 8443</option></select></label></div><button class="btn" type="submit">Compare fixture outcome</button><div class="sim-result" data-sim-result role="status" hidden></div></form></section></div>`;
  }
  function device() {
    return `${exampleBanner()}<div class="devicehead section" data-od-id="device-header"><div class="device-symbol">${Icon("devices")}</div><div><h2>Example device A</h2><p>Example segment A \xB7 device D-0024 \xB7 ${Badge("Recently observed")}</p><p class="mono">192.0.2.24 \xB7 2001:db8:a::24 \xB7 02:00:00:00:00:24</p><p>Lease association valid at flow time \xB7 last observed 09:29:40 UTC</p></div></div><div class="tabs" role="tablist" aria-label="Device evidence" data-od-id="device-tabs">${["Summary", "Traffic", "Firewall", "Addresses", "History"].map((n, i) => `<button class="tab" id="tab-${n.toLowerCase()}" role="tab" aria-controls="panel-${n.toLowerCase()}" aria-selected="${n === "Firewall"}" tabindex="${n === "Firewall" ? "0" : "-1"}" data-tab="${n.toLowerCase()}">${n}</button>`).join("")}</div><section role="tabpanel" id="panel-firewall" aria-labelledby="tab-firewall">${firewall()}</section><section role="tabpanel" id="panel-summary" aria-labelledby="tab-summary" hidden><div class="two"><div class="panel"><h2>Identity evidence</h2><dl class="keylist"><dt>Association</dt><dd>Lease valid at observation time</dd><dt>Alias</dt><dd>Example device A \xB7 console-only annotation</dd><dt>Presence</dt><dd>Recently observed; probe reachability not established</dd></dl></div><div class="panel"><h2>Reachability evidence</h2><p class="callout">Observed denial for IPv4 TCP/443 to Example segment B. Other destinations and IPv6 remain qualified by supported policy semantics.</p><a class="btn" href="flow-inspector.html">Open recorded flow</a></div></div></section><section role="tabpanel" id="panel-traffic" aria-labelledby="tab-traffic" hidden>${Inspector()}</section><section role="tabpanel" id="panel-addresses" aria-labelledby="tab-addresses" hidden><div class="panel"><h2>Address-binding history</h2><dl class="keylist"><dt>IPv4</dt><dd class="mono">192.0.2.24 \xB7 DHCP lease<br>09:00\u201310:00 UTC</dd><dt>IPv6</dt><dd class="mono">2001:db8:a::24 \xB7 neighbour observation<br>09:29:40 UTC</dd><dt>Historical flow</dt><dd>F-0081 uses the binding valid at 09:27:18. No retrospective reassignment.</dd></dl></div></section><section role="tabpanel" id="panel-history" aria-labelledby="tab-history" hidden><div class="panel"><h2>Device events</h2>${events()}</div></section>`;
  }
  function flow() {
    return `${exampleBanner()}<div class="split section">${Inspector()}<section class="panel" data-od-id="flow-source-chain"><div class="sectionhead"><h2>Source \u2192 policy \u2192 observation</h2>${Badge("Evidence qualified")}</div>${RuleDetail(policies[1])}<div class="divider"></div><h3>What remains unknown</h3><p class="callout">No application-level response is recorded. Port 443 does not establish application identity. Traffic that stayed inside an unrelated switch is unobserved.</p><button class="btn" data-export-denied>Export evidence \xB7 permission limited</button></section></div>`;
  }
  function reference() {
    return `${exampleBanner()}<section class="specimen" data-od-id="reference-compositions"><h2>Representative compositions</h2><p class="muted">Four small operational examples built from the same components. The source documents define the broader application; these examples establish the system.</p><div class="spec-links"><a href="overview.html" data-od-id="open-overview"><span><strong>Overview</strong><small>Aligned measurements, missing samples and correlated changes</small></span><span aria-hidden="true">\u2197</span></a><a href="device-firewall.html" data-od-id="open-firewall"><span><strong>Device \xB7 Firewall tab</strong><small>Installed, applicable, observed and source provenance</small></span><span aria-hidden="true">\u2197</span></a><a href="flow-inspector.html" data-od-id="open-flow"><span><strong>Flow / provenance inspector</strong><small>Original tuple, translation evidence and recorded hook path</small></span><span aria-hidden="true">\u2197</span></a><a href="access-states.html" data-od-id="open-access"><span><strong>Authentication and error states</strong><small>Configured OIDC provider, local recovery and permissions</small></span><span aria-hidden="true">\u2197</span></a></div></section><section class="specimen" data-od-id="reference-badges"><h2>Evidence is part of the interface</h2><p class="muted">A policy lifecycle, an applicability claim and a traffic observation are different statements.</p><div class="badge-row">${Badge("Installed")}${Badge("Applicable")}${Badge("Observed match")}${Badge("Allow", "good")}${Badge("Observed denial", "bad")}${Badge("Stale evidence", "warn")}${Badge("Unobserved", "unknown")}${Badge("Origin unavailable", "unknown")}</div><div class="two section"><div class="notice"><span class="symbol">\u25B3</span><div><p><strong>No observations since 09:14</strong></p><p class="muted">Lease remains valid. Current reachability is unknown.</p></div></div><div class="notice"><span class="symbol">?</span><div><p><strong>Shared rule counter</strong></p><p class="muted">1,284 matches across the rule. Device attribution unavailable.</p></div></div></div></section><section class="specimen" data-od-id="reference-controls"><h2>Controls</h2><p class="muted">44px targets. Teal is reserved for a main action and selection. Theme and density preferences stay local.</p><div class="toolbar"><button class="btn primary" data-inspect="POL-042">Inspect rule</button><button class="btn" data-copy="POL-042">Copy rule ID</button><button class="btn" data-export-denied>Export \xB7 permission limited</button><label class="control-label"><span class="sr">Density</span><select class="input" data-density><option value="comfortable">Comfortable rows</option><option value="compact">Compact rows</option></select></label></div></section><section class="specimen" data-od-id="reference-table"><h2>Policy table</h2><p class="muted">Inspectable records with the observation boundary carried into each row.</p>${PolicyTable()}</section><section class="specimen" data-od-id="reference-chart"><h2>Chart lane</h2><p class="muted">Neutral solid/dashed series and filled areas leave status colour available for evidence.</p>${Chart()}</section><section class="specimen" data-od-id="reference-state-library"><h2>Evidence and loading states</h2><div class="two"><div class="state-stack"><div class="notice"><span class="symbol">?</span><div><p><strong>Origin unavailable</strong></p><p class="muted">Snapshot lacks source producer metadata.</p></div></div><div class="notice"><span class="symbol">\u25B3</span><div><p><strong>Unsupported observation</strong></p><p class="muted">This image does not expose physical switch ports.</p></div></div><div class="notice"><span class="symbol">\u25CB</span><div><p><strong>No observed matches</strong></p><p class="muted">Installed and applicable does not mean traffic matched.</p></div></div></div><div class="panel"><div role="status"><strong>Loading a bounded snapshot</strong><div class="loading-bar" aria-hidden="true"></div><p class="small muted">No stale value is relabelled as current.</p></div><div class="divider"></div><strong>No records in this interval</strong><p class="small muted" style="margin-top:8px">Choose a retained interval. Empty evidence is not an allow verdict.</p></div></div></section>`;
  }
  function App(page = "reference") {
    const titles = { reference: ["Component reference", "Reusable Router Console specimens", "Overview"], overview: ["Overview", "Network observations, with their evidence boundary", "Overview"], device: ["Devices", "Device policy and provenance", "Devices"], flow: ["Traffic", "Flow and provenance inspector", "Traffic"], auth: ["System", "Console access and evidence failure", "System"] };
    const [title, sub, active] = titles[page];
    return `<a class="skip" href="#main">Skip to content</a><div class="shell">${Sidebar(active)}<div class="content"><header class="topbar" data-od-id="global-toolbar"><label style="flex:1;max-width:360px"><span class="sr">Search fictional examples by name, address, MAC, domain or rule ID</span><input class="input" data-global-search placeholder="Search device, address, domain, rule\u2026" data-od-id="global-search"></label><small class="muted">Draft \xB7 local examples \xB7 UTC</small></header><main class="main" id="main" tabindex="-1" data-od-id="main-content"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="index.html">Reference</a><span aria-hidden="true">/</span><span>${title}</span></nav><div class="pagehead" data-od-id="page-heading"><div><h1>${title}</h1><p>${sub}</p></div><div class="toolbar">${page === "auth" ? '<button class="btn" data-theme-toggle>Graphite theme</button>' : timeSelector()}</div></div><section data-search-results class="search-results" aria-label="Example search results" aria-live="polite" hidden></section>${page === "overview" ? overview() : page === "device" ? device() : page === "flow" ? flow() : page === "auth" ? `${exampleBanner()}<div class="two section"><div id="auth-panel">${AuthPanel()}</div>${AccessStates()}</div>` : reference()}<footer class="preview-footer"><span>Router Console / draft design system</span><a href="../../DESIGN.md">System rules</a><a href="../../preview/colors-foundations.html">Foundations</a><a href="../../storybook/index.html">Storybook</a></footer></main></div></div>${InspectionDialog()}<div class="toast" role="status" data-toast hidden></div>`;
  }
  function mount(root, page = "reference") {
    root.innerHTML = App(page);
    bindInteractions(root);
  }
  function bindInteractions(root) {
    let sorted = false;
    let restoreFocus = null;
    let toastTimer;
    const q = (s) => root.querySelector(s);
    const all = (s) => Array.from(root.querySelectorAll(s));
    const preference = (key, value) => {
      try {
        if (value !== void 0) localStorage.setItem("router-console-" + key, value);
        return localStorage.getItem("router-console-" + key);
      } catch {
        return null;
      }
    };
    function theme(t) {
      document.documentElement.dataset.theme = t;
      all("[data-theme-toggle]").forEach((b) => {
        b.textContent = t === "dark" ? "Switch to light" : "Switch to graphite";
        b.setAttribute("aria-label", `Switch to ${t === "dark" ? "light" : "graphite"} theme`);
      });
    }
    theme(preference("theme") || "light");
    document.documentElement.dataset.density = preference("density") || "comfortable";
    all("[data-density]").forEach((x) => x.value = document.documentElement.dataset.density);
    const toast = (s) => {
      const e = q("[data-toast]");
      if (e) {
        e.textContent = s;
        e.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => e.hidden = true, 5e3);
      }
    };
    function filter() {
      const needle = q("[data-policy-search]")?.value.toLowerCase() || "";
      const type = q("[data-policy-filter]")?.value || "all";
      let rows = policies.filter((p) => Object.values(p).join(" ").toLowerCase().includes(needle)).filter((p) => type === "all" || (type === "matched" ? p.id === "POL-042" : ["POL-108", "POL-211"].includes(p.id)));
      if (sorted) rows = rows.slice().reverse();
      const tbody = q("[data-policy-rows]");
      if (tbody) tbody.innerHTML = policyRows(rows);
      const count = q("[data-policy-count]");
      if (count) count.textContent = `${rows.length} of 4 example rules \xB7 bounded snapshot`;
    }
    root.addEventListener("click", async (event) => {
      const target = event.target.closest("button,a");
      if (!target) return;
      if (target.hasAttribute("data-theme-toggle")) {
        const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        theme(t);
        preference("theme", t);
      }
      if (target.hasAttribute("data-export-denied")) toast("Export denied: the Viewer role lacks flow-metadata export permission. No file was created.");
      if (target.hasAttribute("data-provider-retry")) toast("Identity provider unavailable. Use the provisioned local recovery account; this is a local example.");
      if (target.hasAttribute("data-refresh-evidence")) {
        const e = q("[data-refresh-result]");
        if (e) e.textContent = "No observations since 09:14. The example snapshot remains stale.";
      }
      if (target.hasAttribute("data-clear-filter")) {
        const input = q("[data-policy-search]");
        if (input) input.value = "";
        const select = q("[data-policy-filter]");
        if (select) select.value = "all";
        filter();
        input?.focus();
      }
      if (target.hasAttribute("data-sort-policy")) {
        sorted = !sorted;
        all("[data-policy-order]").forEach((s) => s.value = sorted ? "desc" : "asc");
        target.closest("th")?.setAttribute("aria-sort", sorted ? "descending" : "ascending");
        filter();
      }
      if (target.hasAttribute("data-copy")) {
        const text = target.dataset.copy;
        try {
          if (!navigator.clipboard) throw Error("Clipboard unavailable");
          await navigator.clipboard.writeText(text);
          toast(`Copied ${text}`);
        } catch {
          toast(`Clipboard unavailable. Select and copy this identifier: ${text}`);
        }
      }
      if (target.hasAttribute("data-inspect")) {
        const p = policies.find((p2) => p2.id === target.dataset.inspect);
        const dialog = q("#policy-dialog");
        if (p && dialog) {
          restoreFocus = target;
          all("[data-rule]").forEach((r) => r.classList.toggle("selected", r.dataset.rule === p.id));
          q("[data-rule-detail]").innerHTML = RuleDetail(p);
          q("#policy-dialog-title").textContent = `${p.id} \xB7 provenance`;
          dialog.showModal();
          q("[data-close-inspector]")?.focus();
        }
      }
      if (target.hasAttribute("data-close-inspector")) q("#policy-dialog")?.close();
      if (target.hasAttribute("data-tab")) selectTab(target);
    });
    q("#policy-dialog")?.addEventListener("close", () => restoreFocus?.focus());
    q("#policy-dialog")?.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      const dialog = q("#policy-dialog");
      const items = Array.from(dialog.querySelectorAll('button,a[href],input,select,[tabindex="0"]'));
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        last?.focus();
        event.preventDefault();
      } else if (!event.shiftKey && document.activeElement === last) {
        first?.focus();
        event.preventDefault();
      }
    });
    function selectTab(button) {
      const id = button.dataset.tab;
      all("[data-tab]").forEach((t) => {
        const selected = t === button;
        t.setAttribute("aria-selected", String(selected));
        t.tabIndex = selected ? 0 : -1;
      });
      all('[role="tabpanel"]').forEach((p) => p.hidden = p.id !== `panel-${id}`);
      button.focus();
    }
    q('[role="tablist"]')?.addEventListener("keydown", (event) => {
      const e = event;
      const tabs = all("[data-tab]");
      let index = tabs.indexOf(document.activeElement);
      if (e.key === "ArrowRight") index = (index + 1) % tabs.length;
      else if (e.key === "ArrowLeft") index = (index - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") index = 0;
      else if (e.key === "End") index = tabs.length - 1;
      else return;
      e.preventDefault();
      selectTab(tabs[index]);
    });
    root.addEventListener("input", (event) => {
      const t = event.target;
      if (t.hasAttribute("data-policy-search")) filter();
      if (t.hasAttribute("data-global-search")) {
        const result = q("[data-search-results]");
        if (!result) return;
        const s = t.value.trim().toLowerCase();
        result.hidden = !s;
        if (!s) return;
        const links = [{ name: "Example device A \xB7 192.0.2.24 \xB7 2001:db8:a::24 \xB7 02:00:00:00:00:24", path: "device-firewall.html" }, { name: "Example flow F-0081 \xB7 service.example \xB7 198.51.100.60", path: "flow-inspector.html" }, ...policies.map((p) => ({ name: `${p.id} \xB7 ${p.name} \xB7 ${p.source}`, path: `device-firewall.html#${p.id}` }))].filter((x) => x.name.toLowerCase().includes(s));
        result.innerHTML = links.length ? `<strong>${links.length} matching fictional records</strong>${links.map((x) => `<a href="${x.path}">${escape(x.name)}</a>`).join("")}` : "No matching example records. Try POL-042 or 192.0.2.24.";
      }
    });
    root.addEventListener("change", (event) => {
      const t = event.target;
      if (t.hasAttribute("data-policy-filter")) filter();
      if (t.hasAttribute("data-policy-order")) {
        sorted = t.value === "desc";
        q("[data-sort-policy]")?.closest("th")?.setAttribute("aria-sort", sorted ? "descending" : "ascending");
        filter();
      }
      if (t.hasAttribute("data-density")) {
        document.documentElement.dataset.density = t.value;
        preference("density", t.value);
      }
      if (t.hasAttribute("data-time-range")) {
        all("[data-charts]").forEach((e) => e.innerHTML = Chart("throughput", t.value) + '<div class="divider"></div>' + Chart("latency", t.value));
        all("[data-charts-1]").forEach((e) => e.innerHTML = Chart("throughput", t.value));
        all("[data-charts-2]").forEach((e) => e.innerHTML = Chart("latency", t.value));
        toast(`Selected ${t.value}-minute fictional observation fixture. No live data requested.`);
      }
    });
    root.addEventListener("submit", (event) => {
      const form = event.target;
      if (form.hasAttribute("data-recovery-form")) {
        event.preventDefault();
        const a = form.querySelector('[name="account"]');
        const p = form.querySelector('[name="password"]');
        const result = form.querySelector("[data-recovery-result]");
        const missing = !a.value.trim() || !p.value;
        a.setAttribute("aria-invalid", String(!a.value.trim()));
        p.setAttribute("aria-invalid", String(!p.value));
        result.hidden = false;
        result.classList.toggle("error", missing);
        result.textContent = missing ? "Enter the provisioned account name and password." : "Example form validated. No authentication request was sent and no session was created.";
        if (missing) (!a.value.trim() ? a : p).focus();
        else form.reset();
      }
      if (form.hasAttribute("data-simulation")) {
        event.preventDefault();
        const dest = form.querySelector('[name="destination"]').value;
        const port = form.querySelector('[name="port"]').value;
        const e = q("[data-sim-result]");
        e.hidden = false;
        e.textContent = dest === "segment" && port === "443" ? "Simulated fixture outcome: deny via POL-042. The separately recorded flow F-0081 had an observed denial. Application connectivity remains unknown." : dest === "service" && port === "8443" ? "Simulated fixture outcome: partial. Grant v3 expired at 09:24; the last installed snapshot is stale. Current installation and observed verdict are unknown." : "Simulated fixture outcome: unsupported tuple. This fixture has no complete policy path or observed verdict for the selected destination and port.";
      }
    });
    const hash = location.hash.slice(1);
    if (policies.some((p) => p.id === hash)) {
      const button = q(`[data-inspect="${hash}"]`);
      button?.click();
    }
  }
  return __toCommonJS(App_exports);
})();
