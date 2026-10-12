/* Generated from TypeScript. Edit the paired .ts source and rebuild. */
"use strict";
var RouterPreviewCard = (() => {
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

  // ui_kits/app/components/PreviewCard.ts
  var PreviewCard_exports = {};
  __export(PreviewCard_exports, {
    PreviewCard: () => PreviewCard
  });

  // ui_kits/app/components/Badge.ts
  function escape(value) {
    return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function Badge(label, tone = "plain", id = "") {
    const symbol = { plain: "\u25CB", good: "\u2713", warn: "\u25B3", bad: "\xD7", unknown: "?" }[tone];
    return `<span class="badge ${tone}" ${id ? `data-od-id="${escape(id)}"` : ""}><span aria-hidden="true">${symbol}</span>${escape(label)}</span>`;
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
  function policyRows(rows) {
    return rows.map((p) => `<tr data-rule="${p.id}" data-od-id="rule-${p.id.toLowerCase()}"><td data-label="Rule / source"><span><strong class="mono no-wrap-desktop">${p.id}</strong><span class="sub no-wrap-desktop">${escape(p.name)}</span><span class="sub muted no-wrap-desktop" style="margin-top:2px;">${escape(p.source)} \xB7 ${escape(p.version)}</span></span></td><td data-label="Effect / scope"><span>${Badge(p.effect, p.tone)}<span class="sub no-wrap-desktop">${escape(p.scope)}</span></span></td><td data-label="Applicability"><span>${p.id === "POL-108" ? Badge("Installed \xB7 stale", "warn") : Badge("Installed", "plain")}<span class="sub no-wrap-desktop">${escape(p.applicable)}</span></span></td><td data-label="Evidence"><span>${p.id === "POL-042" ? Badge("Observed match", "good") : p.id === "POL-010" ? Badge("Shared counter", "plain") : Badge(p.matches, "unknown")}<span class="sub no-wrap-desktop ${p.id === "POL-042" || p.id === "POL-010" ? "mono" : ""}">${escape(p.matches)}</span></span></td><td data-label="Details" style="text-align:right"><button class="btn text row-inspect" data-inspect="${p.id}" aria-label="Inspect rule ${p.id}">Inspect \u2197</button></td></tr>`).join("") || '<tr><td colspan="5"><div class="empty"><strong>No matching rules</strong><p>Try a rule ID, source or effect.</p><button class="btn" data-clear-filter>Clear filters</button></div></td></tr>';
  }

  // ui_kits/app/components/Inspector.ts
  function RuleDetail(p) {
    return `<div class="badge-row" style="margin-bottom:20px">${Badge(p.effect, p.tone)}${Badge(p.id === "POL-108" ? "Installed \xB7 stale" : "Installed")}${Badge(p.id === "POL-042" ? "Observed match" : "Match evidence qualified", "unknown")}</div><div class="two"><dl class="keylist"><dt>Rule</dt><dd class="mono">${p.id}</dd><dt>Conditions</dt><dd>${escape(p.conditions)}</dd><dt>Inherited scope</dt><dd>${escape(p.scope)}</dd><dt>Version</dt><dd class="mono">${escape(p.version)}</dd></dl><dl class="keylist"><dt>Lifetime</dt><dd>${escape(p.expiry)}</dd><dt>Observed snapshot</dt><dd class="mono">${escape(p.observed)}</dd><dt>Applicable</dt><dd>${escape(p.applicable)}</dd><dt>Match evidence</dt><dd>${escape(p.matches)}</dd></dl></div><h3 style="margin:28px 0 12px">Policy provenance</h3><ol class="chain"><li><p>${escape(p.source)}</p><small>${escape(p.producer)}</small></li><li><p>${escape(p.version)}</p><small>${p.id === "POL-108" ? "Historical install receipt; expiry passed. Removal is not established." : "Installed in observed snapshot \xB7 r42"}</small></li><li><p>${escape(p.scope)}</p><small>${escape(p.conditions)}</small></li><li><p>${escape(p.matches)}</p><small>${p.id === "POL-010" ? "Counter belongs to the whole rule; no device attribution." : "No further application-connectivity evidence."}</small></li></ol><p class="callout">${p.id === "POL-211" ? "Origin unavailable. The router snapshot does not include producer metadata." : p.id === "POL-108" ? "The last install observation is stale. Expiry alone does not prove removal." : "The source and observation time qualify this explanation."}</p>`;
  }

  // ui_kits/app/components/App.ts
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

  // ui_kits/app/components/PreviewCard.ts
  function PreviewCard(html) {
    const e = document.createElement("div");
    e.innerHTML = html + '<div class="toast" data-toast role="status" hidden></div>';
    bindInteractions(e);
    const stories = { "index.html": "reference", "overview.html": "overview", "device-firewall.html": "device-firewall", "flow-inspector.html": "flow-provenance", "access-states.html": "authentication" };
    for (const a of e.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href");
      if (href.startsWith("#")) continue;
      if (stories[href.split("#")[0]]) {
        a.href = `./index.html?path=/story/compositions-app--${stories[href.split("#")[0]]}`;
        a.target = "_parent";
      } else if (href.startsWith("../../")) a.href = "../" + href.slice(6);
    }
    return e;
  }
  return __toCommonJS(PreviewCard_exports);
})();
