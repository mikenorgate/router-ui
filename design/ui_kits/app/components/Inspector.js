/* Generated from TypeScript. Edit the paired .ts source and rebuild. */
"use strict";
var RouterInspector = (() => {
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

  // ui_kits/app/components/Inspector.ts
  var Inspector_exports = {};
  __export(Inspector_exports, {
    InspectionDialog: () => InspectionDialog,
    Inspector: () => Inspector,
    RuleDetail: () => RuleDetail
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
  return __toCommonJS(Inspector_exports);
})();
