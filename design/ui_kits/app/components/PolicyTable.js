/* Generated from TypeScript. Edit the paired .ts source and rebuild. */
"use strict";
var RouterPolicyTable = (() => {
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

  // ui_kits/app/components/PolicyTable.ts
  var PolicyTable_exports = {};
  __export(PolicyTable_exports, {
    PolicyTable: () => PolicyTable,
    policies: () => policies,
    policyRows: () => policyRows
  });

  // ui_kits/app/components/Badge.ts
  function escape(value) {
    return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function Badge(label, tone = "plain", id = "") {
    const symbol = { plain: "\u25CB", good: "\u2713", warn: "\u25B3", bad: "\xD7", unknown: "?" }[tone];
    return `<span class="badge ${tone}" ${id ? `data-od-id="${escape(id)}"` : ""}><span aria-hidden="true">${symbol}</span>${escape(label)}</span>`;
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
  return __toCommonJS(PolicyTable_exports);
})();
