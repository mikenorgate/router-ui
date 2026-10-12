/* Generated from TypeScript. Edit the paired .ts source and rebuild. */
"use strict";
var RouterChart = (() => {
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

  // ui_kits/app/components/Chart.ts
  var Chart_exports = {};
  __export(Chart_exports, {
    Chart: () => Chart
  });
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
  return __toCommonJS(Chart_exports);
})();
