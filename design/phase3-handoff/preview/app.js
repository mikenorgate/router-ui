/* Router Console — Phase 3 investigation preview.
   Standalone design preview: no network, no build step, fictional labelled
   data. Mirrors the React handoff in design/phase3-handoff/src. State that an
   operator would share — filters, time window, selection, inspector reference
   — lives in the URL hash (#/view?params); theme/role/density persist locally. */
'use strict';

/* ---------- utilities ---------- */
const $ = (sel, root) => (root || document).querySelector(sel);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = minutes => new Date(Date.now() - minutes * 60000).toISOString();
const fmtTs = value => { if (!value || !Number.isFinite(Date.parse(value))) return 'Observation time unavailable'; return new Date(value).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'; };
const fmtClock = value => Number.isFinite(Date.parse(value)) ? new Date(value).toISOString().slice(11, 16) : 'Unknown';
const fmtNum = value => typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(value) : 'Unavailable';
const fmtBytes = value => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Unavailable';
  const n = Math.max(0, value);
  const unit = n >= 1073741824 ? 'GiB' : n >= 1048576 ? 'MiB' : n >= 1024 ? 'KiB' : 'B';
  const factor = { GiB: 1073741824, MiB: 1048576, KiB: 1024, B: 1 }[unit];
  return `${fmtNum(n / factor)} ${unit}`;
};
const fmtEndpoint = (ip, port) => !ip ? 'Address unavailable' : `${ip.includes(':') ? `[${ip}]` : ip}${port == null ? '' : `:${port}`}`;
const fmtSampling = rate => rate == null || !Number.isFinite(rate) || rate <= 0 ? 'Sampling rate unavailable' : rate === 1 ? 'Unsampled' : rate < 1 ? `Sampled · ${fmtNum(rate * 100)}%` : `Sampled · 1 in ${fmtNum(rate)}`;

const SYMBOLS = { plain: '○', good: '✓', warn: '△', bad: '×', unknown: '?' };
const badge = (tone, text) => `<span class="badge ${tone}"><span aria-hidden="true">${SYMBOLS[tone] || SYMBOLS.plain}</span>${esc(text)}</span>`;
function toneFor(status) {
  const value = String(status || '').toLowerCase();
  if (/unknown|unsupported|unobserved|unavailable|missing|nxdomain/.test(value)) return 'unknown';
  if (/stale|sampled|partial|expired|warning|degraded/.test(value)) return 'warn';
  if (/blocked|denied|deny|error|down|failed|critical|servfail/.test(value)) return 'bad';
  if (/allowed|allow|current|up|recently observed|healthy|ready|noerror|observed|configured/.test(value)) return 'good';
  return 'plain';
}
const statusBadge = value => badge(toneFor(value), value || 'Unknown');

/* ---------- fictional fixture data (mirrors src/lib/phase3Demo.ts) ---------- */
const BOOT = 'boot-example-7f2c';
const DEVICES = [
  { id: 'device-a', name: 'Example workstation', segment: 'Example segment A', mac: '02:00:00:00:00:24', status: 'recently observed', last_seen: ago(1), addresses: ['192.0.2.24', '2001:db8:1::24'] },
  { id: 'device-b', name: 'Example sensor', segment: 'Example segment B', mac: '02:00:00:00:00:32', status: 'stale', last_seen: ago(90), addresses: ['198.51.100.32'] },
  { id: 'device-c', name: 'Unidentified device', segment: 'Example segment A', status: 'unknown', last_seen: null, addresses: ['192.0.2.80'] },
];
const FLOWS = [
  { id: 'flow-01', ref: 'obs-flow-01', device: 'device-a', src: '192.0.2.24', sport: 52144, dst: '198.51.100.60', dname: 'service.example', dport: 443, proto: 'TCP', sent: 1248, recv: 0, verdict: 'blocked', rule: 'rule-042', last: ago(5), rate: 0.25 },
  { id: 'flow-02', ref: 'obs-flow-02', device: 'device-a', src: '192.0.2.24', sport: 50111, dst: '203.0.113.40', dname: null, dport: 443, proto: 'TCP', sent: 845622, recv: 14806528, verdict: 'allowed', rule: 'rule-010', last: ago(1), rate: 0.25, translated: '203.0.113.10' },
  { id: 'flow-03', ref: 'obs-flow-03', device: 'device-a', src: '2001:db8:1::24', sport: 53510, dst: '2001:db8:2::60', dname: null, dport: 443, proto: 'UDP', sent: null, recv: null, verdict: 'unknown', rule: null, last: ago(2), rate: 0.25 },
  { id: 'flow-04', ref: 'obs-flow-04', device: 'device-c', src: '192.0.2.80', sport: 53110, dst: '192.0.2.1', dname: null, dport: 53, proto: 'UDP', sent: 96, recv: 312, verdict: 'allowed', rule: 'rule-005', last: ago(9), rate: 1 },
  { id: 'flow-05', ref: 'obs-flow-05', device: 'device-a', src: '192.0.2.24', sport: 52201, dst: '198.51.100.60', dname: 'service.example', dport: 8443, proto: 'TCP', sent: 980, recv: 0, verdict: 'blocked', rule: 'rule-042', last: ago(11), rate: 0.25 },
  { id: 'flow-06', ref: 'obs-flow-06', device: 'device-b', src: '198.51.100.32', sport: 49120, dst: '203.0.113.5', dname: null, dport: 123, proto: 'UDP', sent: 76, recv: 76, verdict: 'allowed', rule: 'rule-012', last: ago(91), rate: 1 },
];
const DNS = [
  { id: 'dns-01', ref: 'obs-dns-01', device: 'device-a', name: 'service.example', type: 'A', rcode: 'NOERROR', answers: 2, resolver: 'router-local', latency: 12, observed: ago(7) },
  { id: 'dns-02', ref: 'obs-dns-02', device: 'device-a', name: 'cdn.example', type: 'AAAA', rcode: 'NOERROR', answers: 1, resolver: 'router-local', latency: 18, observed: ago(9) },
  { id: 'dns-03', ref: 'obs-dns-03', device: 'device-c', name: 'unresolved.example', type: 'A', rcode: 'NXDOMAIN', answers: 0, resolver: 'router-local', latency: 41, observed: ago(12) },
  { id: 'dns-04', ref: 'obs-dns-04', device: 'device-b', name: 'updates.example', type: 'A', rcode: 'SERVFAIL', answers: null, resolver: 'upstream', latency: null, observed: ago(90) },
];
const EVENTS = [
  { id: 'event-1', time: ago(5), kind: 'firewall', severity: 'warning', title: 'Attributed connection denial', detail: 'Forwarding observation references rule-042. This does not establish application connectivity.', device: 'device-a', rule: 'rule-042', ref: 'obs-event-01' },
  { id: 'event-2', time: ago(12), kind: 'policy', severity: 'warning', title: 'Recorded grant expiry passed', detail: 'Expiry is recorded; removal awaits a later installed snapshot.', device: 'device-a', rule: 'rule-108' },
  { id: 'event-3', time: ago(20), kind: 'collection', severity: 'warning', title: 'Collection gap', detail: 'Eight flow records lost. Missing measurements are not zero traffic.' },
  { id: 'event-4', time: ago(34), kind: 'system', severity: 'info', title: 'Installed policy revision observed', detail: 'Revision example-r42 remains installed. Policy lifecycle does not imply traffic success.' },
  { id: 'event-5', time: ago(90), kind: 'address', severity: 'info', title: 'IPv6 address association observed', detail: 'Neighbour evidence associated this address at the recorded time; identity confidence remains qualified.', device: 'device-a' },
  { id: 'event-6', time: ago(95), kind: 'collection', severity: 'error', title: 'Source observation failed', detail: 'Wireless metrics source is unsupported on this image; the state is recorded, not hidden.' },
];
const RANKINGS = [
  { device: 'device-a', label: 'Example workstation', sent: 845622, recv: 14806528, share: 0.91, evidence: 'observed', ref: 'obs-flow-02' },
  { device: 'device-c', label: 'Unidentified device', sent: 12480, recv: 0, share: 0.06, evidence: 'partial', ref: 'obs-flow-03' },
  { device: 'device-b', label: 'Example sensor', sent: null, recv: null, share: null, evidence: 'unknown', ref: null },
];
const UNATTRIBUTED = { sent: 64000, recv: 512000, note: 'Traffic without a binding valid at observation time. Never reassigned to a device retroactively.' };
const METRICS = [
  { id: 'download', label: 'Interface receive rate', value: '58.2', unit: 'Mbit/s', status: 'current', scope: 'Router interface · shared', observed: ago(0.5) },
  { id: 'upload', label: 'Interface transmit rate', value: '16', unit: 'Mbit/s', status: 'current', scope: 'Router interface · shared', observed: ago(0.5) },
  { id: 'latency', label: 'Gateway probe latency', value: '24', unit: 'ms', status: 'stale', scope: 'Router-originated probe · last success', observed: ago(7) },
  { id: 'loss', label: 'Packet loss', value: null, unit: '%', status: 'unsupported', scope: 'No qualified loss source', observed: null },
];
const EXPOSURE = {
  generated: ago(0),
  listeners: [
    { id: 'listener-1', address: '192.0.2.1', port: 443, proto: 'TCP', label: 'Router console (this interface)', restriction: 'Example management segment only', state: 'observed', ref: 'image manifest example-r8', evidence: 'Listener observed open on the configured address.' },
    { id: 'listener-2', address: '192.0.2.1', port: 53, proto: 'UDP/TCP', label: 'Local DNS resolver', restriction: 'Example segments A and B', state: 'observed', ref: 'bundled configuration example-r42', evidence: 'Resolver answers on configured segment addresses.' },
    { id: 'listener-3', address: '2001:db8:1::1', port: 53, proto: 'UDP/TCP', label: 'Local DNS resolver (IPv6)', restriction: 'Example segments A and B', state: 'stale', ref: 'bundled configuration example-r42', evidence: 'Last confirmed 34 minutes ago; snapshot is stale.' },
  ],
  forwards: [
    { id: 'forward-1', listen: '203.0.113.10:8443/TCP', target: '192.0.2.24:8443', restriction: '198.51.100.0/24 only', state: 'configured', ref: 'bundled configuration example-r42', evidence: 'Configured in revision example-r42; inbound attempts unobserved in this window.' },
  ],
  inbound: [
    { rule: 'rule-301', action: 'allow', scope: 'Forwarding rule forward-1', restriction: '198.51.100.0/24 only', installed: 'Installed', applicable: 'Applicable', observed: 'Match unobserved', origin: 'Configuration compiler · example-r42', evidence: 'A configured permission is not observed traffic.' },
    { rule: 'rule-399', action: 'deny', scope: 'Router baseline · inbound default', restriction: 'All other sources', installed: 'Installed', applicable: 'Applicable', observed: 'Observed match', origin: 'Image policy compiler · example-r8', evidence: 'Shared rule counter; denials are not attributed to sources.' },
  ],
  notes: [
    'Configured exposure is shown from the installed policy and image manifests. The console performs no scan, ping or probe; external reachability is never verified.',
    'A listener without a matching inbound permission is still blocked by policy; a permission without a listener does not expose a service.',
    'Dynamic port mappings are unsupported by this image and would appear here with a labelled producer if present.',
  ],
};
const OBSERVATIONS = {};
for (const flow of FLOWS) OBSERVATIONS[flow.ref] = {
  identity: { ref: flow.ref, kind: 'flow', source: 'flow-observer', sourceKind: 'Flow metadata', boot: BOOT, record: `seq-${1180 + FLOWS.indexOf(flow)}`, recorded: flow.last },
  evidence: flow.verdict === 'blocked' ? 'Attributed verdict at the forwarding observation point. Application connectivity unknown.' : flow.verdict === 'allowed' ? 'Attributed firewall match; no application-level response recorded.' : 'Conversation observed; no attributed verdict or byte counters available.',
  flow,
  links: [{ rel: 'device', href: `#/devices/${flow.device}`, label: `Device ${flow.device}` }]
    .concat(flow.rule ? [{ rel: 'rule', href: `#/firewall?rule=${flow.rule}`, label: `Rule ${flow.rule}` }] : [])
    .concat(flow.ref === 'obs-flow-01' || flow.ref === 'obs-flow-03' ? [{ rel: 'investigation', href: `#/investigations/inv-access-${flow.id}`, label: 'Explain access' }] : []),
};
for (const d of DNS) OBSERVATIONS[d.ref] = {
  identity: { ref: d.ref, kind: 'dns', source: 'flow-observer', sourceKind: 'Resolver metadata', boot: BOOT, record: `seq-${5520 + DNS.indexOf(d)}`, recorded: d.observed },
  evidence: 'Resolver metadata association, recorded at query time. A query name does not identify an application.',
  dns: d,
  links: [{ rel: 'device', href: `#/devices/${d.device}`, label: `Device ${d.device}` }],
};
OBSERVATIONS['obs-event-01'] = {
  identity: { ref: 'obs-event-01', kind: 'event', source: 'flow-observer', sourceKind: 'Flow metadata', boot: BOOT, record: 'evt-0091', recorded: ago(5) },
  evidence: 'Event ordering is correlation, not cause.',
  event: EVENTS[0],
  links: [{ rel: 'rule', href: '#/firewall?rule=rule-042', label: 'Rule rule-042' }, { rel: 'investigation', href: '#/investigations/inv-access-flow-01', label: 'Explain access' }],
};
const INVESTIGATIONS = {
  'inv-access-flow-01': {
    ref: 'inv-access-flow-01',
    subject: { device: 'device-a', source: '192.0.2.24', destination: '198.51.100.60', port: 443, protocol: 'TCP', queried: ago(4) },
    decision: { verdict: 'blocked', evidence: 'Attributed deny verdict recorded at the forwarding observation point. This does not describe application connectivity.', observed: ago(5), ref: 'obs-flow-01' },
    predicted: null,
    path: [
      { step: 'Baseline connection-state allowance', rule: 'rule-010', action: 'allow', scope: 'Router baseline', hook: 'forward', order: 10, installed: 'Installed', applicable: 'Not applicable', observed: 'Match unobserved', counters: 'Shared rule counter', origin: 'Image policy compiler · established-replies · example-r8 · image manifest' },
      { step: 'Segment egress restriction', rule: 'rule-042', action: 'deny', scope: 'Inherited · Example segment A', hook: 'forward', order: 42, installed: 'Installed', applicable: 'Applicable', observed: 'Observed match', counters: 'Shared rule counter', origin: 'Configuration compiler · segment-egress · example-r42 · bundled configuration' },
      { step: 'Time-limited service grant (context)', rule: 'rule-108', action: 'allow', scope: 'Device-specific exception', hook: 'forward', order: 108, installed: 'Installed', applicable: 'Not applicable', observed: 'Match unobserved', counters: 'Counter scope unknown', origin: 'Local grant receiver · service-grant · example-v3 · local install receipt' },
    ],
    binding: { device: 'device-a', address: '192.0.2.24', from: ago(180), until: null, source: 'Local lease', confidence: 'Lease association valid at the observation time' },
    translation: { recorded: false, note: 'No translation recorded for this tuple; none is inferred.' },
    route: { iface: 'Example uplink', nextHop: '203.0.113.1', evidence: 'Route lookup recorded by the forwarding observer; egress was never reached.' },
    unresolved: [
      'Did the application handshake complete? No application-level evidence exists.',
      'Is the recorded destination name current? Resolver metadata age applies.',
      'Would the expired grant have matched before expiry? Expired policy is not re-evaluated.',
    ],
    limits: [
      'Flow collection samples one in four conversations; absence of a record is not absence of traffic.',
      'A shared rule counter is not a per-device count.',
      'The expired grant and this denial are correlated in time only; correlation is not cause.',
    ],
  },
  'inv-access-flow-03': {
    ref: 'inv-access-flow-03',
    subject: { device: 'device-a', source: '2001:db8:1::24', destination: '2001:db8:2::60', port: 443, protocol: 'UDP', queried: ago(3) },
    decision: null,
    predicted: { result: 'Partial prediction only', basis: 'IPv6 destination set expansion is unsupported by this console build.' },
    path: [
      { step: 'IPv6 destination set', rule: 'rule-211', action: 'unknown', scope: 'Inherited · Example group', hook: 'forward', order: 211, installed: 'Installed', applicable: 'Applicability unknown', observed: 'Match unobserved', counters: 'Counter scope unknown', origin: 'Origin unavailable · example-r42' },
    ],
    binding: { device: 'device-a', address: '2001:db8:1::24', from: ago(90), until: null, source: 'Neighbour observation', confidence: 'Observed association; privacy addresses rotate' },
    translation: { recorded: false, note: 'No translation recorded; none is inferred.' },
    route: null,
    unresolved: [
      'Was this conversation allowed? No attributed verdict was recorded.',
      'Which set members did rule-211 match? Set expansion is unsupported.',
      'What carried the traffic? UDP/443 alone does not identify an application.',
    ],
    limits: ['Origin unavailable for rule-211.', 'Unsupported set semantics produce a partial explanation, never a guessed verdict.'],
  },
};

/* Deterministic fixture series with an explicit missing-sample gap. */
function laneSeries(id, label, unit, base, spread, gapIndexes) {
  const points = [];
  for (let i = 0; i < 31; i++) {
    points.push({ time: ago(60 - i * 2), value: gapIndexes.includes(i) ? null : Math.round(base + spread * Math.exp(-((i - 13) ** 2) / 30) + (i % 4) * 2) });
  }
  return { id, label, unit, points };
}

/* ---------- preferences ---------- */
const pref = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
const setPref = (key, value) => { try { localStorage.setItem(key, value); } catch { /* optional */ } };
const state = { theme: pref('console-theme', 'light'), role: pref('console-role', 'operator'), density: pref('console-density', 'comfortable') };
function applyPrefs() {
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.dataset.density = state.density;
}

/* ---------- routing: hash path + query params ---------- */
function route() {
  const hash = location.hash.replace(/^#/, '') || '/overview';
  const [pathPart, queryPart] = hash.split('?');
  return { path: pathPart || '/overview', params: new URLSearchParams(queryPart || '') };
}
function navigate(path, params) {
  const search = params && params.toString();
  location.hash = `#${path}${search ? `?${search}` : ''}`;
}
function setParam(key, value) {
  const { path, params } = route();
  if (value) params.set(key, value); else params.delete(key);
  if (!['cursor', 'observation', 'tab'].includes(key)) params.delete('cursor');
  navigate(path, params);
}
function href(path, extra) {
  const { params } = route();
  const next = new URLSearchParams();
  for (const key of ['range', 'from', 'to']) if (params.get(key)) next.set(key, params.get(key));
  for (const [key, value] of Object.entries(extra || {})) if (value) next.set(key, value);
  const search = next.toString();
  return `#${path}${search ? `?${search}` : ''}`;
}

/* ---------- shared renderers ---------- */
function notice(kind, title, text) { return `<div class="notice" role="status">${badge(kind, title)}<p>${text}</p></div>`; }
function accessDenied(detail) { return `<div class="notice" data-od-id="permission-limited" role="status">${badge('unknown', 'Permission limited')}<p>${esc(detail || 'Traffic, DNS and investigation detail require the Operator or Administrator role. Summaries remain available.')}</p></div>`; }
function emptyState(title, detail) { return `<div class="empty" role="status"><h3>${esc(title)}</h3><p>${esc(detail)}</p></div>`; }
function loadingBlock(label) { return `<div class="loading" role="status"><span class="loading-bar"></span>${esc(label || 'Loading router observations…')}</div>`; }
function fields(pairs) {
  return `<dl class="keylist">${pairs.map(([label, value]) => `<div class="field-pair"><dt>${esc(label)}</dt><dd>${value == null || value === '' ? 'Unavailable' : value}</dd></div>`).join('')}</dl>`;
}

/* Sortable bounded table; sorting applies to the rendered page only. */
function table(container, config) {
  const rows = config.rows;
  if (!rows.length) { container.innerHTML = emptyState(config.empty || 'No matching observations', 'Try changing filters, or check source coverage and observation times.'); return; }
  const sortKey = container.dataset.sortKey || '';
  const sortDesc = container.dataset.sortDesc === '1';
  const col = config.columns.find(c => c.key === sortKey && c.sort);
  const sorted = col ? [...rows].sort((a, b) => {
    const x = col.sort(a), y = col.sort(b);
    if (x == null) return y == null ? 0 : 1;
    if (y == null) return -1;
    const n = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'en-GB', { numeric: true });
    return sortDesc ? -n : n;
  }) : rows;
  container.innerHTML = `<table class="table responsive"><caption>${esc(config.caption)}</caption><thead><tr>${config.columns.map(c =>
    `<th scope="col" ${c.sort ? `aria-sort="${sortKey === c.key ? (sortDesc ? 'descending' : 'ascending') : 'none'}"` : ''}>${c.sort ? `<button class="btn text" data-sort="${c.key}">${esc(c.label)}<span aria-hidden="true"> ${sortKey === c.key ? (sortDesc ? '↓' : '↑') : '↕'}</span></button>` : esc(c.label)}</th>`).join('')}</tr></thead>
    <tbody>${sorted.slice(0, 200).map(row => `<tr data-row-id="${esc(row.id || '')}">${config.columns.map(c => `<td data-label="${esc(c.label)}"><div>${c.render(row)}</div></td>`).join('')}</tr>`).join('')}</tbody></table>
    <div class="tablefoot"><span class="mono">${Math.min(sorted.length, 200)} records in this bounded page</span><span>Sorting applies to this page</span></div>`;
  for (const button of container.querySelectorAll('[data-sort]')) {
    button.addEventListener('click', () => {
      const key = button.dataset.sort;
      container.dataset.sortDesc = container.dataset.sortKey === key && sortDesc ? '0' : '1';
      container.dataset.sortKey = key;
      table(container, config);
    });
  }
}

/* Aligned lanes on one shared axis: gaps break paths, markers cross lanes,
   one cursor, keyboard inspection, table alternatives. */
function drawLanes(container, { lanes, markers, selectable, onSelect, heightPerLane }) {
  const valid = lanes.map(lane => ({ ...lane, points: lane.points.filter(p => Number.isFinite(Date.parse(p.time))) })).filter(lane => lane.points.length);
  if (!valid.length) { container.innerHTML = emptyState('No timeline samples in this window', 'Missing measurements are not zero traffic. Check source coverage for this view.'); return; }
  const times = valid.flatMap(lane => lane.points.map(p => Date.parse(p.time)));
  const start = Math.min(...times), end = Math.max(...times), duration = Math.max(end - start, 1);
  const LEFT = 8, WIDTH = 784, VIEW_W = 800, LANE_H = 56, GAP_H = heightPerLane || 34;
  const viewH = valid.length * (LANE_H + GAP_H) + 26;
  const x = ms => LEFT + (ms - start) / duration * WIDTH;
  const laneTop = index => 20 + index * (LANE_H + GAP_H);
  const scales = valid.map(lane => {
    const max = Math.max(1, ...lane.points.map(p => p.value == null ? 0 : p.value));
    const rough = max / 3, base = 10 ** Math.floor(Math.log10(rough));
    const step = [1, 2, 2.5, 5, 10].find(f => rough <= f * base) || 10;
    return { step: step * base, max: step * base * 3 };
  });
  const uid = `lanes-${Math.random().toString(36).slice(2, 8)}`;
  const inWindow = (markers || []).filter(m => Number.isFinite(Date.parse(m.time)) && Date.parse(m.time) >= start && Date.parse(m.time) <= end).slice(0, 16);
  const lanesSvg = valid.map((lane, index) => {
    const top = laneTop(index), scale = scales[index];
    const y = value => top + LANE_H - Math.max(0, value) / scale.max * LANE_H;
    const groups = []; let group = [];
    for (const p of lane.points) { if (p.value == null) { if (group.length) groups.push(group); group = []; } else group.push(p); }
    if (group.length) groups.push(group);
    const path = groups.map(g => g.map((p, i) => `${i ? 'L' : 'M'}${x(Date.parse(p.time))} ${y(p.value)}`).join(' ')).join(' ');
    const area = groups.map(g => `M${x(Date.parse(g[0].time))} ${top + LANE_H} ${g.map(p => `L${x(Date.parse(p.time))} ${y(p.value)}`).join(' ')} L${x(Date.parse(g[g.length - 1].time))} ${top + LANE_H} Z`).join(' ');
    const missing = lane.points.filter(p => p.value == null);
    return `<g>
      <text x="${LEFT}" y="${top - 6}" class="chart-label">${esc(lane.label)} · ${esc(lane.unit)} · 0–${fmtNum(scale.max)}</text>
      <line x1="${LEFT}" x2="${LEFT + WIDTH}" y1="${top + LANE_H}" y2="${top + LANE_H}" class="chart-grid"></line>
      <path d="${area}" class="chart-fill"></path>
      ${missing.map(p => `<rect x="${Math.max(LEFT, x(Date.parse(p.time)) - 4)}" y="${top}" width="8" height="${LANE_H}" fill="url(#${uid}-gap)"><title>Missing sample · not zero traffic</title></rect>`).join('')}
      <path d="${path}" class="${index % 2 ? 'chart-secondary' : 'chart-line'}"></path>
    </g>`;
  }).join('');
  container.innerHTML = `<div class="chart-wrap"><svg viewBox="0 0 ${VIEW_W} ${viewH}" role="img" tabindex="0" ${selectable ? 'data-selectable="true"' : ''} aria-labelledby="${uid}-title ${uid}-desc">
    <title id="${uid}-title">${esc(valid.map(l => l.label).join(', '))}</title>
    <desc id="${uid}-desc">Shared time axis ${fmtTs(new Date(start).toISOString())} to ${fmtTs(new Date(end).toISOString())}. Missing samples break each lane. Arrow keys move a shared cursor; Enter selects an interval. Value tables follow.</desc>
    <defs><pattern id="${uid}-gap" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="var(--unknown-soft)"></rect><path d="M0 6L6 0" stroke="var(--control-border)"></path></pattern></defs>
    ${lanesSvg}
    ${inWindow.map(m => `<line x1="${x(Date.parse(m.time))}" x2="${x(Date.parse(m.time))}" y1="16" y2="${viewH - 26}" class="chart-event"><title>${esc(m.label)} · ${fmtTs(m.time)}</title></line>`).join('')}
    <line class="chart-hover-line" data-hover-line y1="16" y2="${viewH - 26}" x1="-10" x2="-10"></line>
    ${[0, 1, 2, 3].map(i => `<text x="${LEFT + i * WIDTH / 3}" y="${viewH - 8}" text-anchor="${i === 3 ? 'end' : 'start'}" class="chart-label">${fmtClock(new Date(start + duration * i / 3).toISOString())}</text>`).join('')}
  </svg><div class="chart-tip" data-tip hidden></div></div>
  <div class="chart-mobile-axis mono" aria-hidden="true"><span>${fmtClock(new Date(start).toISOString())} UTC</span><span>${fmtClock(new Date(end).toISOString())} UTC</span></div>
  <div class="chart-note"><span>UTC · one shared cursor across lanes · gaps break the measured path${selectable ? ' · click or press Enter to select an interval' : ''}</span><span>${inWindow.length} markers in window</span></div>
  ${valid.map((lane, index) => `<details class="data-summary"><summary>View ${esc(lane.label)} values</summary><table class="table responsive"><caption>${esc(lane.unit)} · source coverage qualifies these observations.</caption><thead><tr><th>Time (UTC)</th><th>Value</th><th>Evidence</th></tr></thead><tbody>${lane.points.map(p => `<tr><td data-label="Time" class="mono">${fmtTs(p.time)}</td><td data-label="Value" class="mono">${p.value == null ? 'Unavailable' : fmtNum(p.value)}</td><td data-label="Evidence">${p.value == null ? 'Missing sample' : 'Recorded sample'}</td></tr>`).join('')}</tbody></table></details>`).join('')}`;

  const svg = container.querySelector('svg');
  const line = container.querySelector('[data-hover-line]');
  const tip = container.querySelector('[data-tip]');
  const sortedTimes = [...new Set(times)].sort((a, b) => a - b);
  const nearest = target => sortedTimes.reduce((best, t) => Math.abs(t - target) < Math.abs(best - target) ? t : best, sortedTimes[0]);
  const showCursor = ms => {
    line.setAttribute('x1', x(ms)); line.setAttribute('x2', x(ms));
    const values = valid.map((lane, i) => {
      const p = lane.points.reduce((best, point) => Math.abs(Date.parse(point.time) - ms) < Math.abs(Date.parse(best.time) - ms) ? point : best, lane.points[0]);
      return `<span class="muted">${esc(lane.label)}: ${p.value == null ? '<strong>Missing sample</strong>' : `<strong class="mono">${fmtNum(p.value)} ${esc(lane.unit)}</strong>`}</span>`;
    }).join('');
    const marks = inWindow.filter(m => Math.abs(Date.parse(m.time) - ms) <= duration / 120).slice(0, 3).map(m => `<span class="muted">${esc(m.label)}</span>`).join('');
    tip.innerHTML = `<span class="muted">${fmtClock(new Date(ms).toISOString())} UTC</span>${values}${marks}`;
    tip.hidden = false;
    tip.style.left = `${x(ms) / VIEW_W * 100}%`; tip.style.top = '8px';
    tip.style.transform = `translate(${x(ms) < 150 ? '0' : x(ms) > VIEW_W - 150 ? '-100%' : '-50%'}, 0)`;
  };
  const hideCursor = () => { line.setAttribute('x1', -10); line.setAttribute('x2', -10); tip.hidden = true; };
  let hover = null;
  svg.addEventListener('pointermove', event => {
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return;
    const px = Math.max(LEFT, Math.min(LEFT + WIDTH, (event.clientX - rect.left) / rect.width * VIEW_W));
    hover = nearest(start + (px - LEFT) / WIDTH * duration);
    showCursor(hover);
  });
  svg.addEventListener('pointerleave', hideCursor);
  svg.addEventListener('pointerup', event => { if (selectable && onSelect && hover != null && event.button === 0) onSelect(new Date(hover).toISOString()); });
  svg.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      const index = hover == null ? (delta > 0 ? -1 : sortedTimes.length) : sortedTimes.indexOf(hover);
      hover = sortedTimes[Math.max(0, Math.min(sortedTimes.length - 1, index + delta))];
      showCursor(hover);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      hover = event.key === 'Home' ? sortedTimes[0] : sortedTimes[sortedTimes.length - 1];
      showCursor(hover);
    } else if (event.key === 'Enter' && hover != null && selectable && onSelect) {
      event.preventDefault();
      onSelect(new Date(hover).toISOString());
    } else if (event.key === 'Escape') { hover = null; hideCursor(); }
  });
}

/* ---------- inspector (direct link by opaque reference) ---------- */
let inspectorReturnFocus = null;
function openObservation(ref) {
  closeInspector(true);
  const observation = OBSERVATIONS[ref];
  const dialog = document.createElement('dialog');
  dialog.className = 'inspector-dialog';
  dialog.setAttribute('aria-labelledby', 'inspector-title');
  dialog.dataset.odId = 'inspector';
  let body;
  if (!observation) {
    body = `<div class="notice error" role="alert"><h2>Observation not retained</h2><p>The reference <span class="mono">${esc(ref)}</span> resolved no record. It may be outside the retention window or sampled away; absence is not evidence of absence.</p></div>`;
  } else if (state.role === 'viewer' && ['flow', 'dns'].includes(observation.identity.kind)) {
    body = `<div class="notice error" role="alert"><h2>Access denied</h2><p>This observation resolves to detail that requires the Operator or Administrator role.</p></div>${accessDenied()}`;
  } else {
    const idn = observation.identity;
    const identityFields = fields([
      ['Record kind', badge('plain', idn.kind)],
      ['Observation source', `<span class="mono">${esc(idn.sourceKind)} · ${esc(idn.source)}</span>`],
      ['Router boot', `<span class="mono">${esc(idn.boot)}</span>`],
      ['Producer record', `<span class="mono">${esc(idn.record)}</span>`],
      ['Recorded at', `<time class="mono">${fmtTs(idn.recorded)}</time>`],
    ]);
    let recordHtml = '';
    if (observation.flow) {
      const f = observation.flow;
      recordHtml = fields([
        ['Original tuple', `<span class="mono">${esc(fmtEndpoint(f.src, f.sport))} → ${esc(fmtEndpoint(f.dst, f.dport))} · ${esc(f.proto)}</span>`],
        ['Translated tuple', f.translated ? `<span class="mono">Source: ${esc(f.translated)}</span><span class="sub">Translated ports unavailable in this contract.</span>` : 'No translation recorded; none is inferred.'],
        ['Verdict', statusBadge(f.verdict)],
        ['Sent / received', `<span class="mono">${fmtBytes(f.sent)} / ${fmtBytes(f.recv)}</span>`],
        ['Last seen', `<time class="mono">${fmtTs(f.last)}</time>`],
        ['Sampling', esc(fmtSampling(f.rate))],
        ['Recorded rule', f.rule ? `<span class="mono">${esc(f.rule)}</span>` : 'No attributed rule recorded'],
        ['Application connectivity', 'Unknown · no application-level evidence supplied'],
      ]);
    } else if (observation.dns) {
      const d = observation.dns;
      recordHtml = fields([
        ['Query', `<span class="mono">${esc(d.name)} · ${esc(d.type)}</span>`],
        ['Result', statusBadge(d.rcode)],
        ['Resolver / latency', `${esc(d.resolver)} · ${d.latency == null ? 'Latency unavailable' : `${d.latency} ms`}`],
        ['Observed at', `<time class="mono">${fmtTs(d.observed)}</time>`],
      ]);
    } else if (observation.event) {
      const e = observation.event;
      recordHtml = fields([
        ['Event', esc(e.title)],
        ['Severity / kind', `${statusBadge(e.severity)} <span class="mono">${esc(e.kind)}</span>`],
        ['Time', `<time class="mono">${fmtTs(e.time)}</time>`],
        ['Detail', esc(e.detail)],
      ]);
    }
    const links = (observation.links || []).map(link => link.rel === 'investigation'
      ? `<a class="btn" href="${esc(link.href)}" data-od-id="explain-access-link">${esc(link.label)} ↗</a>`
      : `<a href="${esc(link.href)}">${esc(link.label)}</a>`).join('');
    body = `<div class="stack" data-od-id="observation-body">${identityFields}<p class="callout">${esc(observation.evidence)}</p>${recordHtml}${links ? `<div class="event-links">${links}</div>` : ''}</div>`;
  }
  dialog.innerHTML = `<div class="inspector-top"><h2 id="inspector-title">Observation ${esc(ref)}</h2><button class="btn" data-close autofocus>Close ×</button></div>${body}`;
  inspectorReturnFocus = document.activeElement;
  document.body.appendChild(dialog);
  dialog.querySelector('[data-close]').addEventListener('click', () => setParam('observation', ''));
  dialog.addEventListener('cancel', event => { event.preventDefault(); setParam('observation', ''); });
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (inspectorReturnFocus && inspectorReturnFocus.isConnected) inspectorReturnFocus.focus();
  });
  for (const anchor of dialog.querySelectorAll('a[href^="#/"]')) anchor.addEventListener('click', () => dialog.close());
  dialog.showModal();
}
function closeInspector(silent) {
  const open = document.querySelector('dialog.inspector-dialog[open]');
  if (open) { if (silent) { open.remove(); } else open.close(); }
}

/* ---------- page scaffold ---------- */
const NAV = [
  ['Overview', '/overview', 'M3 3h6v6H3zm12 0h6v6h-6zM3 15h6v6H3zm12 0h6v6H3z'],
  ['Devices', '/devices', 'M4 4h16v12H4zM8 20h8m-4-4v4'],
  ['Traffic', '/traffic', 'M3 8h18m-5-4 5 4-5 4M21 16H3m5-4-5 4 5 4'],
  ['Network', '/network', 'M12 3v6m0 6v6M3 12h6m6 0h6M9 9h6v6H9z'],
  ['Firewall', '/firewall', 'M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6z'],
  ['Events', '/events', 'M5 4h14v17H5zM8 9h8M8 13h8M8 17h5'],
  ['System', '/system', 'M4 6h16M4 12h16M4 18h16M9 3v6m7 0v6M8 15v6'],
];
function navSection(path) {
  if (path.startsWith('/devices')) return '/devices';
  if (path.startsWith('/traffic') || path.startsWith('/investigations')) return '/traffic';
  if (path.startsWith('/network')) return '/network';
  if (path.startsWith('/firewall')) return '/firewall';
  if (path.startsWith('/events')) return '/events';
  if (path.startsWith('/system') || path.startsWith('/states')) return '/system';
  return '/overview';
}
function renderNav(activePath) {
  $('#console-navigation').innerHTML = NAV.map(([label, path, d]) =>
    `<a class="navitem ${navSection(activePath) === path ? 'active' : ''}" ${navSection(activePath) === path ? 'aria-current="page"' : ''} href="#${path}" data-od-id="nav-${label.toLowerCase()}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"></path></svg><span>${label}</span></a>`).join('');
}
function pageHeader(title, description, parent, action) {
  return `<header class="pagehead" data-od-id="page-header"><div>
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="${href('/overview')}">Console</a><span aria-hidden="true">/</span>${parent ? `<a href="${href(`/${parent.toLowerCase()}`)}">${esc(parent)}</a><span aria-hidden="true">/</span>` : ''}<span>${esc(title)}</span></nav>
    <h1 tabindex="-1" data-od-id="page-title">${esc(title)}</h1><p>${esc(description)}</p></div>${action || ''}</header>`;
}
function intervalNotice(params) {
  if (!params.get('from')) return '';
  return `<div class="notice interval-notice" role="status"><p>Selected observation interval: <span class="mono">${esc(params.get('from'))} → ${esc(params.get('to') || 'end unavailable')}</span></p><a href="${href(route().path)}">Clear selected interval</a></div>`;
}

/* ---------- views ---------- */
const main = () => $('#main-content');

function renderOverview(params) {
  const lanes = [
    laneSeries('attributed-rate', 'Attributed devices', 'Mbit/s', 18, 60, [20, 21]),
    laneSeries('unattributed-rate', 'Unattributed bucket', 'Mbit/s', 2, 4, [20, 21]),
  ];
  const markers = EVENTS.slice(0, 3).map(e => ({ time: e.time, label: e.title, kind: e.kind }));
  main().innerHTML = pageHeader('Overview', 'Ranked device traffic and aligned measurements for the selected window, with their evidence qualifiers.', null,
    `<button class="btn" data-reload>Refresh observations</button>`)
    + intervalNotice(params)
    + `<div class="stack">
      <div class="metric-strip" data-od-id="metric-strip">${METRICS.map(m => `<div class="metric" data-od-id="metric-${m.id}"><dl><dt>${esc(m.label)}</dt><dd><span class="value">${m.value == null ? '—' : esc(m.value)}</span><span class="unit mono">${esc(m.unit)}</span></dd></dl><div class="meta">${statusBadge(m.status)}<span>${esc(m.scope)}</span><time>${fmtTs(m.observed)}</time></div></div>`).join('')}</div>
      <section class="panel" data-od-id="interval-summary-chart"><div class="sectionhead"><div><h2>Bandwidth and attribution timeline</h2><p>Lanes share one time axis; gaps break the measured path. Selecting an interval carries it into Traffic.</p></div><a href="${href('/traffic')}">Investigate traffic ↗</a></div>
        <div class="badge-row">${badge('plain', 'Live interval accounting')}${badge('warn', 'Window still accumulating')}${badge('warn', '1 measurement gap')}<span class="muted small mono">Generated ${fmtTs(ago(0))}</span></div>
        <div data-chart></div>
        ${notice('warn', 'Missing measurements', 'One gap in this window — collector restart during image health check. Chart paths break across gaps; a gap is not zero traffic.')}
        ${notice('warn', 'Sampled evidence', `Source sampling: <span class="mono">${fmtSampling(0.25)}</span> · storage sampling: <span class="mono">${fmtSampling(1)}</span>. Collection samples one in four conversations; retention keeps every collected record.`)}
        <p class="callout">Attributed <span class="mono">${fmtNum(15700000)}</span> bytes of <span class="mono">${fmtNum(16300000)}</span> interface bytes. The remainder is unattributed or unsampled traffic, not an error. Interface totals are shared measurements.</p>
      </section>
      <section class="panel" data-od-id="traffic-ranking"><div class="sectionhead"><div><h2>Device traffic ranking</h2><p>Ranked by recorded bytes in this window. Shared interface counters never appear as device totals.</p></div></div><div data-ranking></div></section>
      <section class="panel" data-od-id="recent-events"><div class="sectionhead"><div><h2>Recent events</h2><p>Recorded changes beside the same window; ordering is correlation, not cause.</p></div><a href="${href('/events')}">All events ↗</a></div><ol class="timeline">${EVENTS.slice(0, 4).map(eventRow).join('')}</ol></section>
    </div>`;
  drawLanes($('[data-chart]'), { lanes, markers, selectable: true, onSelect: from => navigate('/traffic', new URLSearchParams({ from, to: ago(0) })) });
  const rankingRows = RANKINGS.map((r, i) => ({ id: r.device, rank: i + 1, ...r }))
    .concat([{ id: 'unattributed', rank: null, label: 'Unattributed bucket', sent: UNATTRIBUTED.sent, recv: UNATTRIBUTED.recv, share: null, evidence: 'unknown', ref: null, device: null }]);
  table($('[data-ranking]'), {
    caption: 'Device traffic ranking · live interval accounting. Shares cover attributed traffic only and never the interface total.',
    empty: 'No attributed traffic in this window',
    rows: rankingRows,
    columns: [
      { key: 'rank', label: 'Rank', sort: r => r.rank ?? 9999, render: r => `<span class="mono">${r.rank ?? '—'}</span>` },
      { key: 'device', label: 'Device', sort: r => r.label, render: r => r.device ? `<a href="${href(`/devices/${r.device}`)}">${esc(r.label)}</a><span class="sub mono">${esc(r.device)}</span>` : `<strong>${esc(r.label)}</strong><span class="sub">${esc(UNATTRIBUTED.note)}</span>` },
      { key: 'sent', label: 'Sent', sort: r => r.sent, render: r => `<span class="cell-num">${fmtBytes(r.sent)}</span>` },
      { key: 'received', label: 'Received', sort: r => r.recv, render: r => `<span class="cell-num">${fmtBytes(r.recv)}</span>` },
      { key: 'share', label: 'Share of attributed', sort: r => r.share, render: r => `<span class="cell-num">${r.share == null ? 'Unavailable' : `${fmtNum(r.share * 100)}%`}</span>` },
      { key: 'evidence', label: 'Evidence', render: r => `${statusBadge(r.evidence)}${r.ref ? ` <button class="btn text" data-inspect="${r.ref}" aria-label="Inspect top observation for ${esc(r.device)}">Inspect ↗</button>` : ''}` },
    ],
  });
  bindInspect(main());
  $('[data-reload]').addEventListener('click', () => renderWithLoading(renderOverview, params));
}

function eventRow(event) {
  return `<li data-od-id="event-${esc(event.id)}"><time datetime="${esc(event.time)}">${fmtTs(event.time)}</time><div>
    <div class="event-heading"><strong>${esc(event.title)}</strong>${statusBadge(event.severity)}</div>
    <p>${esc(event.detail)}</p>
    <div class="event-links">
      ${event.device ? `<a href="${href(`/devices/${event.device}`)}">Device ${esc(event.device)}</a>` : ''}
      ${event.rule ? `<a href="${href('/firewall', { rule: event.rule })}">Rule ${esc(event.rule)}</a>` : ''}
      ${event.ref ? `<button class="btn text" data-inspect="${esc(event.ref)}" aria-label="Inspect observation behind ${esc(event.id)}">Inspect observation ↗</button>` : ''}
    </div></div></li>`;
}
function bindInspect(root) {
  for (const button of root.querySelectorAll('[data-inspect]')) {
    button.addEventListener('click', () => setParam('observation', button.dataset.inspect));
  }
}

function renderTraffic(params) {
  const tab = params.get('tab') === 'dns' ? 'dns' : 'flows';
  if (state.role === 'viewer') {
    main().innerHTML = pageHeader('Traffic', 'Recorded conversations and resolver observations.', null, '') + accessDenied();
    return;
  }
  const filterBar = tab === 'flows'
    ? `<div data-od-id="server-filter-bar"><div class="filterbar">
        <form class="search-filter" data-search><label class="control-label"><span>Search flows</span><input class="input" type="search" name="q" value="${esc(params.get('q') || '')}" maxlength="128" placeholder="Address, name, protocol or rule"></label><button class="btn" type="submit">Search</button></form>
        ${select('verdict', 'Verdict', params, [['', 'All verdicts'], ['allowed', 'Allowed'], ['blocked', 'Blocked'], ['unknown', 'Unknown']])}
        ${select('protocol', 'Protocol', params, [['', 'All protocols'], ['TCP', 'TCP'], ['UDP', 'UDP'], ['ICMP', 'ICMP'], ['ICMPV6', 'ICMPv6']])}
        ${select('family', 'Family', params, [['', 'Both families'], ['4', 'IPv4'], ['6', 'IPv6']])}
        ${select('translation', 'Translation', params, [['', 'All records'], ['recorded', 'Translation recorded'], ['unrecorded', 'No translation recorded']])}
        <button class="btn text" data-clear>Clear filters</button></div>
      <p class="filter-note muted small">Filters apply on the router before pagination; the page below is the filtered result set, bounded per request.</p></div>`
    : `<div data-od-id="server-filter-bar"><div class="filterbar">
        <form class="search-filter" data-search><label class="control-label"><span>Search DNS</span><input class="input" type="search" name="q" value="${esc(params.get('q') || '')}" maxlength="128" placeholder="Query name, type or device"></label><button class="btn" type="submit">Search</button></form>
        ${select('rcode', 'Result', params, [['', 'All results'], ['NOERROR', 'NOERROR'], ['NXDOMAIN', 'NXDOMAIN'], ['SERVFAIL', 'SERVFAIL']])}
        <button class="btn text" data-clear>Clear filters</button></div>
      <p class="filter-note muted small">Filters apply on the router before pagination; the page below is the filtered result set, bounded per request.</p></div>`;
  main().innerHTML = pageHeader('Traffic', 'Recorded conversations and resolver observations. Filters apply on the router before pagination.', null, '')
    + intervalNotice(params)
    + `<div class="tabs" role="tablist" aria-label="Traffic views" data-od-id="traffic-tabs">
      ${['flows', 'dns'].map(name => `<button class="tab" id="tab-${name}" role="tab" aria-selected="${tab === name}" aria-controls="panel-${tab}" tabindex="${tab === name ? 0 : -1}" data-tab="${name}">${name === 'flows' ? 'Flows' : 'DNS'}</button>`).join('')}</div>
    <section id="panel-${tab}" role="tabpanel" aria-labelledby="tab-${tab}" class="stack" data-od-id="traffic-${tab}">
      <section class="panel"><div class="sectionhead"><div><h2>${tab === 'flows' ? 'Flow browser' : 'DNS observations'}</h2><p>${tab === 'flows' ? 'Bounded to 4 records per request in this fixture. Verdicts are attributed observations; an unknown verdict stays unknown.' : 'Resolver metadata with association age. Names do not identify applications; encrypted DNS limits classification.'}</p></div></div>
        ${filterBar}<div data-results></div>
      </section>
    </section>`;
  // Tabs: roving tabindex + arrow/Home/End keys.
  for (const button of main().querySelectorAll('[role="tab"]')) {
    button.addEventListener('click', () => setParam('tab', button.dataset.tab));
    button.addEventListener('keydown', event => {
      const tabs = ['flows', 'dns'];
      const index = tabs.indexOf(button.dataset.tab);
      const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : offset ? (index + offset + tabs.length) % tabs.length : null;
      if (next !== null) { event.preventDefault(); setParam('tab', tabs[next]); requestAnimationFrame(() => $(`#tab-${tabs[next]}`)?.focus()); }
    });
  }
  for (const form of main().querySelectorAll('[data-search]')) form.addEventListener('submit', event => { event.preventDefault(); setParam('q', new FormData(form).get('q').trim().slice(0, 128)); });
  for (const control of main().querySelectorAll('[data-filter]')) control.addEventListener('change', () => setParam(control.dataset.filter, control.value));
  $('[data-clear]')?.addEventListener('click', () => { const keep = ['range', 'from', 'to', 'tab']; const next = new URLSearchParams(); for (const key of keep) if (params.get(key)) next.set(key, params.get(key)); navigate('/traffic', next); });

  const results = $('[data-results]');
  if (tab === 'flows') {
    const q = (params.get('q') || '').toLowerCase();
    const filtered = FLOWS.filter(f =>
      (!q || JSON.stringify(f).toLowerCase().includes(q)) &&
      (!params.get('verdict') || f.verdict === params.get('verdict')) &&
      (!params.get('protocol') || f.proto === params.get('protocol')) &&
      (!params.get('family') || (f.src.includes(':') ? '6' : '4') === params.get('family')) &&
      (!params.get('translation') || (params.get('translation') === 'recorded') === !!f.translated));
    const page = params.get('cursor') === 'p2' ? filtered.slice(4) : filtered.slice(0, 4);
    const overflow = params.get('cursor') !== 'p2' && filtered.length > 4;
    results.innerHTML = (overflow ? notice('plain', 'Bounded result', `Showing ${page.length} of a 4-record bounded page (${filtered.length} matching). Refine filters or follow the cursor; this page is not a total.`) : '') + '<div data-flow-table></div>'
      + `<div class="pagination">${params.get('cursor') === 'p2' ? '<button class="btn" data-page="1">First page</button>' : ''}${overflow ? '<button class="btn" data-page="p2">Next 2 records</button>' : ''}</div>`;
    table($('[data-flow-table]'), {
      caption: 'Recorded conversations. Destination labels come from supplied metadata; ports do not identify applications. Bytes are recorded values, not extrapolated totals.',
      empty: 'No flows match the server-applied filters',
      rows: page,
      columns: [
        { key: 'source', label: 'Source / device', sort: f => f.src, render: f => `<span class="mono">${esc(fmtEndpoint(f.src, f.sport))}</span><a class="sub" href="${href(`/devices/${f.device}`)}">${esc(f.device)}</a>` },
        { key: 'destination', label: 'Destination', sort: f => f.dname || f.dst, render: f => `<span class="mono">${esc(fmtEndpoint(f.dst, f.dport))}</span><span class="sub">${esc(f.dname || 'Name unobserved')}</span>` },
        { key: 'protocol', label: 'Protocol / evidence', sort: f => f.proto, render: f => `<span class="mono">${esc(f.proto)}</span><span class="sub">${esc(fmtSampling(f.rate))}</span>` },
        { key: 'bytes', label: 'Sent / received', sort: f => f.recv, render: f => `<span class="cell-num">${fmtBytes(f.sent)} / ${fmtBytes(f.recv)}</span>` },
        { key: 'verdict', label: 'Verdict / last seen', sort: f => f.verdict, render: f => `${statusBadge(f.verdict)}<span class="sub mono">${fmtTs(f.last)}</span>` },
        { key: 'details', label: 'Details', render: f => `<button class="btn text" data-inspect="${esc(f.ref)}" aria-label="Inspect flow ${esc(f.id)}">Inspect ↗</button>` },
      ],
    });
    for (const button of results.querySelectorAll('[data-page]')) button.addEventListener('click', () => setParam('cursor', button.dataset.page === 'p2' ? 'p2' : ''));
  } else {
    const q = (params.get('q') || '').toLowerCase();
    const filtered = DNS.filter(d => (!q || JSON.stringify(d).toLowerCase().includes(q)) && (!params.get('rcode') || d.rcode === params.get('rcode')));
    results.innerHTML = '<div data-dns-table></div>';
    table($('[data-dns-table]'), {
      caption: 'Recorded resolver observations. Query names are resolver metadata; they do not identify applications, and NXDOMAIN is a resolver answer, not a policy verdict.',
      empty: 'No DNS observations in this window',
      rows: filtered,
      columns: [
        { key: 'query', label: 'Query', sort: d => d.name, render: d => `<span class="mono">${esc(d.name)}</span><span class="sub mono">${esc(d.type)}</span>` },
        { key: 'result', label: 'Result', sort: d => d.rcode, render: d => `${statusBadge(d.rcode)}<span class="sub mono">${d.answers == null ? 'Answers unavailable' : `${d.answers} answers`}</span>` },
        { key: 'device', label: 'Device association', sort: d => d.device, render: d => `<a href="${href(`/devices/${d.device}`)}">${esc(d.device)}</a>` },
        { key: 'resolver', label: 'Resolver / latency', render: d => `${esc(d.resolver)}<span class="sub mono">${d.latency == null ? 'Latency unavailable' : `${d.latency} ms`}</span>` },
        { key: 'observed', label: 'Observed', sort: d => d.observed, render: d => `<time class="mono">${fmtTs(d.observed)}</time>` },
        { key: 'details', label: 'Details', render: d => `<button class="btn text" data-inspect="${esc(d.ref)}" aria-label="Inspect DNS observation ${esc(d.id)}">Inspect ↗</button>` },
      ],
    });
  }
  bindInspect(results);
}
function select(key, label, params, options) {
  return `<label class="control-label"><span>${esc(label)}</span><select class="input" data-filter="${esc(key)}">${options.map(([value, text]) => `<option value="${esc(value)}" ${params.get(key) === value ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select></label>`;
}

function renderDevices() {
  main().innerHTML = pageHeader('Devices', 'Observed identities and address associations. A device is separate from its interfaces, addresses and sessions.', null, '')
    + `<section class="panel"><div class="sectionhead"><div><h2>Inventory</h2><p>Presence evidence is explicit; a stale lease or sleeping device does not prove disconnection.</p></div></div><div data-device-table></div></section>`;
  table($('[data-device-table]'), {
    caption: 'Device inventory with presence evidence. Manual aliases never rename DHCP or DNS records.',
    rows: DEVICES,
    columns: [
      { key: 'name', label: 'Name', sort: d => d.name, render: d => `<a href="${href(`/devices/${d.id}`)}">${esc(d.name)}</a><span class="sub mono">${esc(d.id)}</span>` },
      { key: 'segment', label: 'Segment', sort: d => d.segment, render: d => esc(d.segment) },
      { key: 'addresses', label: 'Current associations', render: d => d.addresses.map(a => `<span class="mono">${esc(a)}</span>`).join('<span class="sub"></span>') },
      { key: 'presence', label: 'Presence', sort: d => d.status, render: d => statusBadge(d.status) },
      { key: 'last', label: 'Last activity', sort: d => d.last_seen, render: d => `<time class="mono">${fmtTs(d.last_seen)}</time>` },
    ],
  });
}

function renderDevice(id, params) {
  const device = DEVICES.find(d => d.id === id);
  if (!device) { main().innerHTML = pageHeader('Device not found', 'This device is not in the inventory fixture.', 'Devices', '') + emptyState('Unknown device', 'Check the inventory or the address-binding history.'); return; }
  const tab = ['conversations', 'dns', 'history'].includes(params.get('tab')) ? params.get('tab') : 'conversations';
  const flows = FLOWS.filter(f => f.device === id);
  const dns = DNS.filter(d => d.device === id);
  const events = EVENTS.filter(e => e.device === id);
  const markers = [
    { time: ago(180), label: 'Address binding recorded: 192.0.2.24', kind: 'address' },
    ...events.map(e => ({ time: e.time, label: e.title, kind: e.kind })),
  ];
  const restricted = state.role === 'viewer';
  let tabContent = '';
  if (tab === 'conversations') {
    tabContent = restricted ? accessDenied() : `<section class="panel"><div class="sectionhead"><div><h2>Conversations in window</h2><p>Recorded flows attributed with bindings valid at the time.</p></div></div><div data-device-flows></div></section>`;
  } else if (tab === 'dns') {
    tabContent = restricted ? accessDenied('DNS observations require the Operator or Administrator role.') : `<section class="panel"><div class="sectionhead"><div><h2>DNS in window</h2><p>Resolver observations for this device’s recorded bindings.</p></div></div><div data-device-dns></div></section>`;
  } else {
    tabContent = `<section class="panel"><div class="sectionhead"><div><h2>Address-binding history</h2><p>Binding validity qualifies historical attribution. An address alone does not prove device identity.</p></div></div>
      <table class="table responsive"><caption>Bindings with provenance and validity windows.</caption><thead><tr><th>Address / family</th><th>Valid from</th><th>Valid until</th><th>Association source</th><th>Confidence</th></tr></thead><tbody>
      <tr><td data-label="Address" class="mono">192.0.2.24<span class="sub">IPv4</span></td><td data-label="Valid from" class="mono">${fmtTs(ago(180))}</td><td data-label="Valid until">End not recorded</td><td data-label="Source">Local lease</td><td data-label="Confidence">Lease association</td></tr>
      <tr><td data-label="Address" class="mono">2001:db8:1::24<span class="sub">IPv6</span></td><td data-label="Valid from" class="mono">${fmtTs(ago(90))}</td><td data-label="Valid until">End not recorded</td><td data-label="Source">Neighbour observation</td><td data-label="Confidence">Observed association</td></tr>
      <tr><td data-label="Address" class="mono">192.0.2.19<span class="sub">IPv4</span></td><td data-label="Valid from" class="mono">${fmtTs(ago(300))}</td><td data-label="Valid until" class="mono">${fmtTs(ago(180))}</td><td data-label="Source">Local lease</td><td data-label="Confidence">Expired binding; historical traffic keeps it</td></tr>
      </tbody></table></section>
      <section class="panel"><div class="sectionhead"><div><h2>Events in window</h2><p>Correlated changes are evidence for investigation, not demonstrated causes.</p></div></div><ol class="timeline">${events.map(eventRow).join('') || '<li>No device events in window.</li>'}</ol></section>`;
  }
  main().innerHTML = pageHeader(device.name, `${device.segment} · traffic, DNS, connections and history in one shared window`, 'Devices',
    `<a class="btn" href="${href('/devices')}">Back to devices</a>`)
    + `<div class="device-context">${statusBadge(device.status)}<span>Last activity <time class="mono">${fmtTs(device.last_seen)}</time></span><span>Observed snapshot <time class="mono">${fmtTs(ago(1))}</time></span></div>`
    + intervalNotice(params)
    + `<section class="panel" data-od-id="time-window-lanes-panel"><div class="sectionhead"><div><h2>Shared time window</h2><p>Traffic, DNS and blocked-connection lanes share one axis. Markers show recorded bindings and events; markers are correlation, not cause.</p></div></div><div data-lanes></div></section>
    <div class="tabs" role="tablist" aria-label="Device details">${['conversations', 'dns', 'history'].map(name => `<button class="tab" id="tab-${name}" role="tab" aria-selected="${tab === name}" aria-controls="panel-${tab}" tabindex="${tab === name ? 0 : -1}" data-tab="${name}">${name[0].toUpperCase() + name.slice(1)}</button>`).join('')}</div>
    <section id="panel-${tab}" role="tabpanel" aria-labelledby="tab-${tab}" class="stack" data-od-id="device-window-${tab}">${tabContent}</section>`;
  drawLanes($('[data-lanes]'), {
    lanes: [
      laneSeries('traffic', 'Traffic rate', 'Mbit/s', 4, 30, [20, 21]),
      laneSeries('dns', 'DNS queries', 'queries', 2, 3, [20, 21]),
      { id: 'blocked', label: 'Blocked connections', unit: 'connections', points: Array.from({ length: 31 }, (_, i) => ({ time: ago(60 - i * 2), value: i >= 16 && i <= 19 ? 3 : 0 })) },
    ],
    markers: markers.filter(m => Number.isFinite(Date.parse(m.time))),
    selectable: true,
    onSelect: from => { setParam('from', from); },
  });
  for (const button of main().querySelectorAll('[role="tab"]')) {
    button.addEventListener('click', () => setParam('tab', button.dataset.tab));
  }
  if (tab === 'conversations' && !restricted) {
    table($('[data-device-flows]'), {
      caption: 'Recorded conversations for bindings valid in this window.',
      empty: 'No conversations recorded for this device in the window',
      rows: flows,
      columns: [
        { key: 'destination', label: 'Destination', sort: f => f.dname || f.dst, render: f => `<span class="mono">${esc(fmtEndpoint(f.dst, f.dport))}</span><span class="sub">${esc(f.dname || 'Name unobserved')}</span>` },
        { key: 'protocol', label: 'Protocol', sort: f => f.proto, render: f => `<span class="mono">${esc(f.proto)}</span>` },
        { key: 'bytes', label: 'Sent / received', sort: f => f.recv, render: f => `<span class="cell-num">${fmtBytes(f.sent)} / ${fmtBytes(f.recv)}</span>` },
        { key: 'verdict', label: 'Verdict / last seen', sort: f => f.verdict, render: f => `${statusBadge(f.verdict)}<span class="sub mono">${fmtTs(f.last)}</span>` },
        { key: 'details', label: 'Details', render: f => `<button class="btn text" data-inspect="${esc(f.ref)}" aria-label="Inspect flow ${esc(f.id)}">Inspect ↗</button>` },
      ],
    });
    bindInspect(main());
  }
  if (tab === 'dns' && !restricted) {
    table($('[data-device-dns]'), {
      caption: 'Resolver observations associated with this device.',
      empty: 'No DNS observations for this device in the window',
      rows: dns,
      columns: [
        { key: 'query', label: 'Query', sort: d => d.name, render: d => `<span class="mono">${esc(d.name)}</span><span class="sub mono">${esc(d.type)}</span>` },
        { key: 'result', label: 'Result', sort: d => d.rcode, render: d => statusBadge(d.rcode) },
        { key: 'observed', label: 'Observed', sort: d => d.observed, render: d => `<time class="mono">${fmtTs(d.observed)}</time>` },
        { key: 'details', label: 'Details', render: d => `<button class="btn text" data-inspect="${esc(d.ref)}" aria-label="Inspect DNS observation ${esc(d.id)}">Inspect ↗</button>` },
      ],
    });
    bindInspect(main());
  }
  if (tab === 'history') bindInspect(main());
}

function renderEvents(params) {
  const severity = params.get('severity'), kind = params.get('kind');
  const filtered = EVENTS.filter(e => (!severity || e.severity === severity) && (!kind || e.kind === kind));
  const active = [severity, kind].filter(Boolean);
  main().innerHTML = pageHeader('Events', 'One linked timeline of recorded changes and observation gaps. Severity and kind are server-side filters.', null,
    `<button class="btn" data-reload>Refresh events</button>`)
    + intervalNotice(params)
    + `<section class="panel" data-od-id="event-timeline-panel"><div class="sectionhead"><div><h2>Event timeline</h2><p>Correlation and ordering do not establish cause; each item links to the evidence behind it.</p></div></div>
      <div data-od-id="server-filter-bar"><div class="filterbar">
        ${select('severity', 'Severity', params, [['', 'All severities'], ['info', 'Info'], ['warning', 'Warning'], ['error', 'Error'], ['critical', 'Critical']])}
        ${select('kind', 'Kind', params, [['', 'All kinds'], ['firewall', 'Firewall'], ['policy', 'Policy'], ['address', 'Address'], ['collection', 'Collection'], ['system', 'System']])}
        <button class="btn text" data-clear>Clear filters</button></div>
      <p class="filter-note muted small">${active.length ? `Server filters applied: ${esc(active.join(', '))}. The returned page is the filtered result set.` : 'No severity or kind filter applied; the bounded page shows all kinds.'}</p></div>
      ${filtered.length ? `<ol class="timeline" data-od-id="linked-events-timeline">${filtered.map(eventRow).join('')}</ol>` : emptyState('No events observed', 'No events match the server-applied filters and window. Widening the window re-queries the router.')}
      <p class="callout">Correlation and ordering do not establish cause. Each item links to the evidence behind it.</p></section>`;
  for (const control of main().querySelectorAll('[data-filter]')) control.addEventListener('change', () => setParam(control.dataset.filter, control.value));
  $('[data-clear]').addEventListener('click', () => navigate('/events', new URLSearchParams()));
  $('[data-reload]').addEventListener('click', () => renderWithLoading(renderEvents, params));
  bindInspect(main());
}

function renderExposure(params) {
  main().innerHTML = pageHeader('Exposure', 'Configured listeners, forwarding and inbound permissions. Configured exposure is never externally verified reachability.', 'Network',
    `<button class="btn" data-reload>Refresh observations</button>`)
    + `<div class="stack" data-od-id="exposure-panel">
      ${notice('plain', 'Configured exposure', `External reachability is never verified by this console — no scan, ping or probe is performed. Generated <time class="mono">${fmtTs(EXPOSURE.generated)}</time>.`)}
      <section class="panel" data-od-id="exposure-listeners"><div class="sectionhead"><div><h2>Router listeners</h2><p>Configured listening addresses with source restrictions. A listener without a matching inbound permission remains blocked by policy.</p></div></div><div data-listeners></div></section>
      <section class="panel" data-od-id="exposure-forwards"><div class="sectionhead"><div><h2>Forwarding rules</h2><p>Configured destination translation toward internal addresses. Configured forwarding is not observed traffic and not verified reachability.</p></div></div><div data-forwards></div></section>
      <section class="panel" data-od-id="exposure-inbound"><div class="sectionhead"><div><h2>Inbound permissions</h2><p>Installed inbound policy affecting forwarded traffic. Applicability does not establish an observed match.</p></div></div><div data-inbound></div></section>
      <ul class="coverage-notes">${EXPOSURE.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
    </div>`;
  table($('[data-listeners]'), {
    caption: 'Configured labels come from image manifests; they are not inferred service names.',
    rows: EXPOSURE.listeners,
    columns: [
      { key: 'address', label: 'Address', sort: l => l.address, render: l => `<span class="mono">${esc(fmtEndpoint(l.address, l.port))}</span><span class="sub">${esc(l.proto)}</span>` },
      { key: 'label', label: 'Configured label', sort: l => l.label, render: l => esc(l.label) },
      { key: 'restriction', label: 'Source restriction', render: l => badge('plain', l.restriction) },
      { key: 'state', label: 'State', sort: l => l.state, render: l => statusBadge(l.state) },
      { key: 'source', label: 'Source reference', render: l => `<span class="mono">${esc(l.ref)}</span>` },
      { key: 'evidence', label: 'Evidence', render: l => `<span class="sub">${esc(l.evidence)}</span>` },
    ],
  });
  table($('[data-forwards]'), {
    caption: 'Configured forwarding with source restrictions and provenance.',
    rows: EXPOSURE.forwards,
    columns: [
      { key: 'listen', label: 'Listen', render: f => `<span class="mono">${esc(f.listen)}</span>` },
      { key: 'target', label: 'Target', render: f => `<span class="mono">${esc(f.target)}</span>` },
      { key: 'restriction', label: 'Source restriction', render: f => badge('plain', f.restriction) },
      { key: 'state', label: 'State', render: f => statusBadge(f.state) },
      { key: 'evidence', label: 'Evidence', render: f => `<span class="sub">${esc(f.evidence)}</span>` },
    ],
  });
  table($('[data-inbound]'), {
    caption: 'Installed inbound policy; a configured permission is not observed traffic.',
    rows: EXPOSURE.inbound.map(r => ({ id: r.rule, ...r })),
    columns: [
      { key: 'rule', label: 'Rule', render: r => `<a class="mono" href="${href('/firewall', { rule: r.rule })}">${esc(r.rule)}</a>` },
      { key: 'action', label: 'Action', render: r => statusBadge(r.action) },
      { key: 'scope', label: 'Scope / restriction', render: r => `${esc(r.scope)}<span class="sub">${esc(r.restriction)}</span>` },
      { key: 'evidence', label: 'Evidence state', render: r => `<div class="badge-row">${badge('plain', r.installed)}${badge('plain', r.applicable)}${badge(r.observed === 'Observed match' ? 'plain' : 'unknown', r.observed)}</div>` },
      { key: 'origin', label: 'Origin', render: r => `<span>${esc(r.origin)}</span><span class="sub">${esc(r.evidence)}</span>` },
    ],
  });
  $('[data-reload]').addEventListener('click', () => renderWithLoading(renderExposure, params));
}

function renderInvestigation(ref, params) {
  const inv = INVESTIGATIONS[ref];
  if (state.role === 'viewer') {
    main().innerHTML = pageHeader('Access explanation', 'Passive explanation of one recorded subject.', 'Traffic', `<a class="btn" href="${href('/traffic')}">Return to traffic</a>`) + accessDenied('Investigations resolve recorded traffic and policy detail and require the Operator or Administrator role.');
    return;
  }
  if (!inv) {
    main().innerHTML = pageHeader('Access explanation', 'Passive explanation of one recorded subject.', 'Traffic', `<a class="btn" href="${href('/traffic')}">Return to traffic</a>`)
      + emptyState('Investigation unavailable', 'Subjects are derived from recorded observations. Open a flow and choose Explain access.');
    return;
  }
  const decision = inv.decision;
  main().innerHTML = pageHeader('Access explanation', 'What was observed, what policy says, what evidence binds them, and what remains unresolved.', 'Traffic',
    `<a class="btn" href="${href('/traffic')}">Return to traffic</a>`)
    + `<div class="stack" data-od-id="access-explanation">
    <section class="panel" data-od-id="explanation-subject"><div class="sectionhead"><div><h2>Subject</h2></div></div>${fields([
      ['Tuple', `<span class="mono">${esc(inv.subject.source)} → ${esc(fmtEndpoint(inv.subject.destination, inv.subject.port))} · ${esc(inv.subject.protocol)}</span>`],
      ['Device', `<a href="${href(`/devices/${inv.subject.device}`)}">${esc(inv.subject.device)}</a>`],
      ['Explanation produced', `<time class="mono">${fmtTs(inv.subject.queried)}</time>`],
    ])}</section>
    <section class="panel" data-od-id="explanation-decision"><div class="sectionhead"><div><h2>Observed decision</h2></div></div>
      ${decision
        ? `<p>${statusBadge(decision.verdict)} <span class="muted">observed <time class="mono">${fmtTs(decision.observed)}</time></span> <button class="btn text" data-inspect="${esc(decision.ref)}">Inspect observation ↗</button></p><p class="callout">${esc(decision.evidence)}</p>`
        : `<p>${badge('unknown', 'No observed decision')} <span class="muted">The router recorded no verdict for this tuple. Any outcome below is predicted, not observed.</span></p>`}
      ${inv.predicted ? `<p data-od-id="predicted-outcome">${badge('warn', 'Simulated outcome')} <span>${esc(inv.predicted.result)}</span> <span class="muted">${esc(inv.predicted.basis)}</span></p>` : ''}
      <p class="callout">An observed or predicted verdict does not establish application connectivity; a recorded conntrack entry alone does not prove success either.</p></section>
    <section class="panel" data-od-id="explanation-policy-path"><div class="sectionhead"><div><h2>Policy path</h2><p>Evaluation order and hook context preserved; this is not flattened into a single first-match list.</p></div></div>
      <ol class="policy-path">${inv.path.map(step => `<li data-od-id="policy-step-${esc(step.rule)}">
        <div class="event-heading"><strong>${esc(step.step)}</strong>${statusBadge(step.action)}</div>
        <div class="badge-row">${badge('plain', step.installed)}${badge(step.applicable === 'Applicable' ? 'plain' : 'unknown', step.applicable)}${badge(step.observed === 'Observed match' ? 'plain' : 'unknown', step.observed)}</div>
        ${fields([
          ['Rule', `<a class="mono" href="${href('/firewall', { rule: step.rule })}">${esc(step.rule)}</a>`],
          ['Scope', esc(step.scope)],
          ['Hook / order', `<span class="mono">${esc(step.hook)} · ${step.order}</span>`],
          ['Origin', esc(step.origin)],
          ['Counters', esc(step.counters)],
        ])}
      </li>`).join('')}</ol></section>
    <section class="panel" data-od-id="explanation-binding"><div class="sectionhead"><div><h2>Address binding at observation time</h2></div></div>${fields([
      ['Address', `<span class="mono">${esc(inv.binding.address)}</span>`],
      ['Device', `<a href="${href(`/devices/${inv.binding.device}`, { tab: 'history' })}">${esc(inv.binding.device)}</a>`],
      ['Valid from / until', `<span class="mono">${fmtTs(inv.binding.from)} / ${inv.binding.until ? fmtTs(inv.binding.until) : 'End not recorded'}</span>`],
      ['Association source', esc(inv.binding.source)],
      ['Confidence', esc(inv.binding.confidence)],
    ])}<p class="callout">Historical traffic is attributed with bindings valid at the time of the event; a current lease does not rewrite history.</p></section>
    <section class="panel" data-od-id="explanation-translation"><div class="sectionhead"><div><h2>Translation evidence</h2></div></div><p class="callout">${esc(inv.translation.note)}</p></section>
    ${inv.route ? `<section class="panel" data-od-id="explanation-route"><div class="sectionhead"><div><h2>Route evidence</h2></div></div>${fields([
      ['Egress interface', esc(inv.route.iface)],
      ['Next hop', `<span class="mono">${esc(inv.route.nextHop)}</span>`],
      ['Evidence', esc(inv.route.evidence)],
    ])}</section>` : ''}
    <section class="panel" data-od-id="explanation-unresolved"><div class="sectionhead"><div><h2>Unresolved questions</h2></div></div>
      <ul class="unresolved-list">${inv.unresolved.map(q => `<li><span aria-hidden="true">? </span>${esc(q)}</li>`).join('')}</ul></section>
    <section class="panel" data-od-id="explanation-limits"><div class="sectionhead"><div><h2>Limits of this explanation</h2></div></div>
      <ul class="coverage-notes">${inv.limits.map(l => `<li>${esc(l)}</li>`).join('')}</ul></section>
  </div>`;
  bindInspect(main());
}

function renderStates() {
  main().innerHTML = pageHeader('Evidence states', 'Designed states for missing, stale, partial, unsupported, bounded and denied evidence. None of these is implied by absence of content.', 'System',
    `<button class="btn" data-replay>Replay loading state</button>`)
    + `<div class="state-grid" data-od-id="states-gallery">
      <section class="panel"><h2>Loading</h2><div data-loading-demo>${loadingBlock()}</div></section>
      <section class="panel"><h2>Empty</h2>${emptyState('No observations in this window', 'The query succeeded; nothing matched. Missing measurements are not zero traffic.')}</section>
      <section class="panel"><h2>Stale</h2>${notice('warn', 'Stale evidence', `This observation may not describe the current state. Last observed <time class="mono">${fmtTs(ago(34))}</time>.`)}</section>
      <section class="panel"><h2>Partial</h2>${notice('warn', 'Partial evidence', 'Two of five sources answered this window; the remaining sources are stale.')}</section>
      <section class="panel"><h2>Unsupported</h2>${notice('unknown', 'Unsupported', 'No qualified packet-loss source exists on this image.')}</section>
      <section class="panel"><h2>Overflow</h2>${notice('plain', 'Bounded result', 'Showing 4 of a 4-record bounded page (6 matching). Refine filters or follow the cursor; this page is not a total.')}</section>
      <section class="panel"><h2>Access denied</h2><div class="notice error" role="alert"><p>The current session does not have permission for this request.</p></div>${accessDenied()}</section>
      <section class="panel"><h2>Viewer redaction</h2><p class="muted">With the fixture role set to Viewer, Traffic, DNS and investigation detail render this state instead of rows:</p>${state.role === 'viewer' ? accessDenied() : badge('unknown', 'Permission limited') + '<p class="muted">Switch the fixture role to Viewer to apply it across Traffic, device detail and investigations.</p>'}</section>
    </div>`;
  $('[data-replay]').addEventListener('click', () => {
    const slot = $('[data-loading-demo]');
    slot.innerHTML = loadingBlock();
    setTimeout(() => { slot.innerHTML = notice('plain', 'Loaded', 'The loading state resolves into content; content never flashes unstyled.'); }, 700);
  });
}

function renderNetworkStub() {
  main().innerHTML = pageHeader('Network', 'Router-local logical interfaces, segments, routes — and configured exposure.', null, '')
    + `${notice('unknown', 'Physical topology unobserved', 'The router cannot infer physical switch ports, wireless signal, or traffic that stays within an unrelated switched segment.')}
    <section class="panel"><div class="sectionhead"><div><h2>Exposure</h2><p>Configured router listeners, forwarding rules and inbound permissions with source restrictions and uncertainty.</p></div><a class="btn" href="${href('/network/exposure')}" data-od-id="open-exposure">Open exposure ↗</a></div>
    <p class="callout">Configured exposure is shown separately from externally verified reachability — which this console never performs.</p></section>`;
}
function renderFirewallStub(params) {
  const rule = params.get('rule');
  main().innerHTML = pageHeader('Firewall', 'Installed policy, applicability and observed matches are covered by the existing console build.', null, '')
    + `${rule ? notice('plain', 'Rule reference carried', `Rule <span class="mono">${esc(rule)}</span> was carried into this section. The phase 1–2 console build renders installed policy, provenance and per-device applicability; phase 3 links land here with the rule selected.`) : ''}
    <section class="panel"><div class="sectionhead"><div><h2>Phase 3 entry points</h2><p>Access explanations reference installed rules; open one to see provenance, evidence badges and unresolved questions.</p></div><a class="btn" href="${href('/investigations/inv-access-flow-01')}" data-od-id="open-explanation">Open example access explanation ↗</a></div></section>`;
}
function renderSystem() {
  main().innerHTML = pageHeader('System', 'Appliance health, sources and console states.', null, '')
    + `<section class="panel"><div class="sectionhead"><div><h2>Observation sources</h2><p>Source freshness is independent of page refresh.</p></div></div>
      <table class="table responsive"><caption>Fixture sources with sampling, lag and loss counts.</caption><thead><tr><th>Source</th><th>Evidence</th><th>Observation time</th><th>Coverage and gaps</th></tr></thead><tbody>
      <tr><td data-label="Source"><strong>Interface counters</strong><span class="sub mono">interface-counters</span></td><td data-label="Evidence">${statusBadge('current')}<span class="sub">${fmtSampling(1)}</span></td><td data-label="Observation time" class="mono">${fmtTs(ago(0.5))}<span class="sub mono">Lag: 30 s</span></td><td data-label="Coverage">Router interfaces; shared totals, not device counters<span class="sub mono">Lost records: 0</span></td></tr>
      <tr><td data-label="Source"><strong>Flow metadata</strong><span class="sub mono">flow-observer</span></td><td data-label="Evidence">${statusBadge('sampled')}<span class="sub">${fmtSampling(0.25)}</span></td><td data-label="Observation time" class="mono">${fmtTs(ago(1))}<span class="sub mono">Lag: 60 s</span></td><td data-label="Coverage">Routed conversations only; intra-segment traffic unobserved<span class="sub mono">Lost records: 8</span></td></tr>
      <tr><td data-label="Source"><strong>Installed policy</strong><span class="sub mono">policy-snapshot</span></td><td data-label="Evidence">${statusBadge('stale')}</td><td data-label="Observation time" class="mono">${fmtTs(ago(34))}<span class="sub mono">Lag: 2040 s</span></td><td data-label="Coverage">Last observed installed revision; current removal not established</td></tr>
      <tr><td data-label="Source"><strong>Wireless metrics</strong><span class="sub mono">radio-observer</span></td><td data-label="Evidence">${statusBadge('unsupported')}</td><td data-label="Observation time">Unavailable</td><td data-label="Coverage">No local wireless observation source</td></tr>
      </tbody></table></section>
    <section class="panel"><div class="sectionhead"><div><h2>Evidence states reference</h2><p>Designed loading, empty, stale, partial, unsupported, overflow and access-denied states used across phase 3 surfaces.</p></div><a class="btn" href="${href('/states')}" data-od-id="open-states">Open states reference ↗</a></div></section>`;
}

/* ---------- boot ---------- */
function renderWithLoading(renderer, arg, params) {
  main().innerHTML = loadingBlock();
  setTimeout(() => renderer(arg, params), 320);
}
function render() {
  const { path, params } = route();
  renderNav(path);
  closeInspector(true);
  document.querySelector('.mobile-nav-toggle')?.setAttribute('aria-expanded', 'false');
  $('#console-navigation').classList.remove('mobile-open');
  if (path === '/overview' || path === '/') renderOverview(params);
  else if (path === '/devices') renderDevices();
  else if (path.startsWith('/devices/')) renderDevice(decodeURIComponent(path.split('/')[2] || ''), params);
  else if (path === '/traffic') renderTraffic(params);
  else if (path === '/network') renderNetworkStub();
  else if (path === '/network/exposure') renderExposure(params);
  else if (path === '/firewall') renderFirewallStub(params);
  else if (path === '/events') renderEvents(params);
  else if (path === '/system') renderSystem();
  else if (path === '/states') renderStates();
  else if (path.startsWith('/investigations/')) renderInvestigation(decodeURIComponent(path.split('/')[2] || ''), params);
  else main().innerHTML = pageHeader('Page not found', 'This path is not part of the console.', null, '') + emptyState('Return to the observatory', '<a href="#/overview">Open overview</a>');
  // Direct-link inspector: resolves the record by reference, independent of
  // whatever the current list page contains.
  if (params.get('observation')) openObservation(params.get('observation'));
  const heading = $('h1');
  document.title = `${heading ? heading.textContent : 'Router Console'} · Router Console`;
  if (heading) heading.focus();
  window.scrollTo(0, 0);
}

function boot() {
  applyPrefs();
  $('#theme-toggle').addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; setPref('console-theme', state.theme); applyPrefs(); $('#theme-toggle').textContent = state.theme === 'dark' ? 'Use light theme' : 'Use dark theme'; });
  $('#theme-toggle').textContent = state.theme === 'dark' ? 'Use light theme' : 'Use dark theme';
  $('#role-select').addEventListener('change', event => { state.role = event.target.value; setPref('console-role', state.role); render(); });
  $('#role-select').value = state.role;
  $('#density-select').addEventListener('change', event => { state.density = event.target.value; setPref('console-density', state.density); applyPrefs(); });
  $('#density-select').value = state.density;
  $('#interval-select').addEventListener('change', event => setParam('range', event.target.value));
  $('.mobile-nav-toggle').addEventListener('click', () => {
    const nav = $('#console-navigation');
    const open = !nav.classList.contains('mobile-open');
    nav.classList.toggle('mobile-open', open);
    $('.mobile-nav-toggle').setAttribute('aria-expanded', String(open));
    $('.mobile-nav-toggle').textContent = open ? 'Close navigation' : 'Open navigation';
  });
  $('.global-search').addEventListener('submit', event => {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get('search') || '').trim().slice(0, 128);
    if (q) navigate('/traffic', new URLSearchParams({ q }));
  });
  window.addEventListener('hashchange', render);
  render();
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
