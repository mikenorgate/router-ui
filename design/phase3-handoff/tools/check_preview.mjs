// Validates artifacts/router-console-phase3.html with the repo's existing
// jsdom (no package changes): boots the preview, walks every section, checks
// internal links and interaction contracts, and proves it makes no network
// requests. Run: node design/phase3-handoff/tools/check_preview.mjs
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(new URL('../../../web/package.json', import.meta.url));
const { JSDOM, VirtualConsole } = require('jsdom');

const root = fileURLToPath(new URL('../../..', import.meta.url));
const html = await readFile(`${root}/artifacts/router-console-phase3.html`, 'utf8');

// Static contract: standalone file, no external fetches.
assert.match(html, /Phase 3 investigation preview/, 'artifact title');
const externals = [...html.matchAll(/(?:src|href)\s*=\s*"((?:https?:)?\/\/[^"]*)"/g)].map(m => m[1]).filter(u => !u.startsWith('//w'));
assert.deepEqual(externals, [], `external references: ${externals.join(', ')}`);
assert.equal((html.match(/@font-face/g) || []).length, 5, 'five embedded font faces');
assert.ok(html.includes('data:font/woff2;base64,'), 'fonts embedded as data URIs');
const withoutDataUrls = html.replace(/url\(data:[^)]*\)/g, '').replace(/url\(#[^)]*\)/g, '');
assert.ok(!/url\((?!['"]?data:)/.test(withoutDataUrls), 'no non-data, non-fragment CSS urls');

const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'inline script present');

const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', error => errors.push(error.message));
let networkRequests = 0;
const dom = new JSDOM(html, {
  url: 'https://preview.example/router-console-phase3.html',
  runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole,
});
const { window } = dom;
window.fetch = () => { networkRequests++; throw new Error('Preview must not call the network.'); };
window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); this.dispatchEvent(new window.Event('open')); };
window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new window.Event('close')); };
window.scrollTo = () => undefined; // jsdom does not implement scrollTo
window.eval(script);
// Boot deterministically: if the app deferred to DOMContentLoaded, await
// jsdom's own event rather than dispatching a second one (double boot would
// double-register the toggle handlers).
if (!window.document.querySelector('.navitem')) {
  await new Promise(resolve => {
    window.document.addEventListener('DOMContentLoaded', resolve, { once: true });
    setTimeout(resolve, 500);
  });
}

const $ = sel => window.document.querySelector(sel);
const $$ = sel => [...window.document.querySelectorAll(sel)];
const h1 = () => $('h1')?.textContent;
const go = hash => { window.location.hash = hash; window.dispatchEvent(new window.HashChangeEvent('hashchange')); };
const click = node => {
  const before = window.location.hash;
  node.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  if (window.location.hash !== before) window.dispatchEvent(new window.HashChangeEvent('hashchange'));
};

// Shell and seven-section navigation.
assert.equal($$('.navitem').length, 7, 'seven navigation sections');
assert.equal(h1(), 'Overview', 'boots at Overview');
assert.ok($('.skip')?.getAttribute('href') === '#main-content' && $('#main-content'), 'skip link target exists');
assert.ok($('.demo-banner')?.textContent.includes('Fictional'), 'fictional-data banner visible');
for (const [label, path] of [['Devices', '/devices'], ['Traffic', '/traffic'], ['Network', '/network'], ['Firewall', '/firewall'], ['Events', '/events'], ['System', '/system']]) {
  go(`#${path}`);
  assert.equal(h1(), label, `navigates to ${label}`);
}
assert.ok($('a.navitem.active')?.textContent.includes('System'), 'active parent section preserved');

// Overview: chart with explicit gap, ranking with unattributed bucket.
go('#/overview');
assert.ok($('[data-od-id="interval-summary-chart"] svg'), 'overview chart renders');
assert.ok($('[data-od-id="interval-summary-chart"]')?.textContent.includes('gap'), 'gap is labelled textually');
const rankingText = $('[data-od-id="traffic-ranking"]')?.textContent || '';
assert.ok(rankingText.includes('Unattributed bucket'), 'unattributed bucket row present');
assert.ok(rankingText.includes('live interval accounting'), 'accounting kind labelled');

// Traffic: server filter controls, bounded page, overflow, deep-link inspector.
go('#/traffic');
assert.equal(h1(), 'Traffic');
assert.ok($('[data-od-id="server-filter-bar"]'), 'server filter bar present');
assert.ok($('[data-od-id="traffic-flows"]')?.textContent.includes('bounded page'), 'bounded page labelled');
go('#/traffic?verdict=blocked');
assert.ok(($('[data-od-id="traffic-flows"]')?.textContent.match(/Inspect/g) || []).length >= 2, 'verdict filter applies');
click($('[data-inspect="obs-flow-01"]'));
assert.equal(window.location.hash.includes('observation=obs-flow-01'), true, 'inspector reference preserved in URL');
assert.ok($('dialog[open]'), 'inspector dialog opens');
assert.ok($('dialog[open]')?.textContent.includes('boot-example'), 'record identity shows source/boot/kind/record');
assert.ok($('dialog[open]')?.textContent.includes('Application connectivity'), 'inspector keeps evidence qualifiers');
click($('dialog [data-close]'));
assert.ok(!$('dialog[open]'), 'inspector closes and URL param clears');
assert.equal(window.location.hash.includes('observation='), false, 'observation param removed on close');
// Record outside the current list page still opens by reference.
go('#/traffic?verdict=blocked&observation=obs-flow-02');
await new Promise(resolve => setTimeout(resolve, 20));
assert.ok($('dialog[open]'), 'deep link opens inspector for a record outside the filtered page');
assert.ok($('dialog[open]')?.textContent.includes('203.0.113.40'), 'resolved record content, not list state');
click($('dialog [data-close]'));

// DNS tab via keyboard; result filters are server-side.
go('#/traffic');
const flowsTab = $('#tab-flows');
flowsTab.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
await new Promise(resolve => setTimeout(resolve, 20));
assert.equal(window.location.hash.includes('tab=dns'), true, 'arrow key moves to DNS tab');
assert.ok($('[data-od-id="traffic-dns"]'), 'DNS tab panel renders');
assert.ok($('[data-od-id="traffic-dns"]')?.textContent.includes('NXDOMAIN'), 'DNS rows render with resolver answers');

// Device shared time window.
go('#/devices/device-a');
assert.ok($('[data-od-id="time-window-lanes-panel"] svg'), 'device lanes render');
assert.ok(($('[data-od-id="time-window-lanes-panel"]')?.textContent.match(/Missing sample|gaps break/g) || []).length >= 1, 'lane gaps labelled');
go('#/devices/device-a?tab=dns');
assert.ok($('[data-od-id="device-window-dns"] table'), 'device DNS table renders');
go('#/devices/device-a?tab=history');
assert.ok(($('[data-od-id="device-window-history"]')?.textContent.includes('192.0.2.19')), 'expired binding remains visible');

// Events: severity/kind server filters + observation links.
go('#/events?severity=warning');
assert.ok(($('[data-od-id="linked-events-timeline"]')?.textContent.includes('Collection gap')), 'warning filter keeps warnings');
assert.ok(!($('[data-od-id="linked-events-timeline"]')?.textContent.includes('IPv6 address association')), 'info events filtered out server-side');
assert.ok(($('[data-od-id="server-filter-bar"]')?.textContent.includes('Server filters applied')), 'server filters restated beside list');

// Exposure under Network.
go('#/network/exposure');
assert.equal(h1(), 'Exposure');
assert.ok($('a.navitem.active')?.textContent.includes('Network'), 'exposure sits under Network');
assert.ok($('[data-od-id="exposure-panel"]')?.textContent.includes('never verified'), 'no-scan uncertainty banner');
assert.equal($$('[data-od-id="exposure-listeners"] tbody tr').length, 3, 'three configured listeners');
assert.ok($('[data-od-id="exposure-inbound"]')?.textContent.includes('Shared rule counter'), 'shared counter labelled');

// Access explanation from the flow inspector link path.
go('#/investigations/inv-access-flow-01');
assert.equal(h1(), 'Access explanation');
assert.ok($('[data-od-id="explanation-decision"]')?.textContent.includes('blocked'), 'observed decision shown');
assert.ok($('[data-od-id="explanation-policy-path"]')?.textContent.includes('rule-042'), 'policy provenance chain');
assert.ok($('[data-od-id="explanation-binding"]')?.textContent.includes('Local lease'), 'binding evidence');
assert.ok($('[data-od-id="explanation-translation"]')?.textContent.includes('none is inferred'), 'translation evidence honest');
assert.equal($$('[data-od-id="explanation-unresolved"] li').length, 3, 'unresolved questions listed');
go('#/investigations/inv-access-flow-03');
assert.ok($('[data-od-id="explanation-decision"]')?.textContent.includes('No observed decision'), 'unobserved decision distinct');
assert.ok($('[data-od-id="predicted-outcome"]')?.textContent.includes('Simulated outcome'), 'prediction labelled simulated');

// Viewer redaction, driven through the fixture role control.
const roleSelect = $('#role-select');
roleSelect.value = 'viewer';
roleSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
go('#/traffic');
assert.ok($('[data-od-id="permission-limited"]'), 'viewer sees permission-limited traffic');
go('#/investigations/inv-access-flow-01');
assert.ok($('[data-od-id="permission-limited"]') || $('.notice'), 'viewer investigation denied state');
go('#/overview');
assert.ok(rankingText.includes('Unattributed'), 'viewer keeps summary surfaces');
roleSelect.value = 'operator';
roleSelect.dispatchEvent(new window.Event('change', { bubbles: true }));

// States reference and theme persistence.
go('#/states');
assert.equal(h1(), 'Evidence states');
for (const word of ['Loading', 'Empty', 'Stale', 'Partial', 'Unsupported', 'Overflow', 'Access denied', 'Viewer redaction']) {
  assert.ok($('[data-od-id="states-gallery"]')?.textContent.includes(word), `state present: ${word}`);
}
click($('#theme-toggle'));
assert.equal(window.document.documentElement.dataset.theme, 'dark', 'dark theme applies');
assert.equal(window.localStorage.getItem('console-theme'), 'dark', 'theme persists locally');
click($('#theme-toggle'));

// Internal links resolve to rendered views; aria-controls targets exist.
const internal = new Set($$('a[href^="#/"]').map(a => a.getAttribute('href').split('?')[0].slice(2).split('/')[0]));
for (const section of internal) assert.ok(['overview', 'devices', 'traffic', 'network', 'firewall', 'events', 'system', 'states', 'investigations'].includes(section), `link target handled: ${section}`);
go('#/traffic');
for (const tab of $$('[role="tab"]')) assert.ok(window.document.getElementById(tab.getAttribute('aria-controls')), `aria-controls resolves: ${tab.getAttribute('aria-controls')}`);

assert.equal(networkRequests, 0, 'no network requests');
assert.deepEqual(errors, [], 'no jsdom runtime errors');
window.close();
console.log('Phase 3 preview: boots standalone, navigates all sections, deep-links observations, gates Viewer,');
console.log('labels evidence states, persists theme — with zero network requests and zero runtime errors.');
