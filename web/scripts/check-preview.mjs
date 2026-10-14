import { readFile } from 'node:fs/promises';
import { JSDOM, VirtualConsole } from 'jsdom';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = await readFile('../router-console-preview.html', 'utf8');
const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'Preview must embed the application bundle.');
assert.match(html, /<title>Lanrith console · explicit demo preview<\/title>/);
assert.match(html, /rel="icon"[^>]*href="data:image\/svg\+xml;base64,|href="data:image\/svg\+xml;base64,[^"]*"[^>]*rel="icon"/);
const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
assert.ok(css?.includes('Manrope'), 'Preview must include the canonical Manrope binding.');
for (const [, url] of css.matchAll(/url\(([^)]+)\)/g)) {
  assert.ok(url.replace(/["']/g, '').startsWith('data:'), 'All preview font/CSS assets must be embedded.');
}
for (const asset of ['lanrith-wordmark.svg', 'lanrith-wordmark-reverse.svg', 'lanrith-favicon.svg']) {
  const bytes = await readFile(new URL(`../../design/assets/${asset}`, import.meta.url));
  assert.ok(html.includes(`data:image/svg+xml;base64,${bytes.toString('base64')}`), `Preview must embed the exact ${asset}.`);
}
assert.ok(html.includes(await readFile(new URL('../public/licenses/OFL-manrope.txt', import.meta.url), 'utf8')), 'Preview must carry the Manrope licence.');
const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', error => errors.push(error.message));
let networkRequests = 0;
const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
  url: 'about:blank', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole,
});
dom.window.Headers = Headers;
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
dom.window.scrollTo = () => undefined;
dom.window.fetch = () => { networkRequests++; throw new Error('Explicit preview must not call the network.'); };
dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
try {
  const module = new vm.SourceTextModule(script, {
    context: dom.getInternalVMContext(), identifier: 'about:blank',
    initializeImportMeta(meta) { meta.url = 'about:blank'; },
  });
  await module.link(specifier => { throw new Error(`Preview has an unexpected external import: ${specifier}`); });
  await module.evaluate();
} catch (error) { throw new Error(`Preview bootstrap failed: ${error.message}`); }
async function until(check) {
  for (let i = 0; i < 100; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
  assert.fail(`Preview did not reach its expected state. Runtime errors: ${errors.join('; ')}`);
}
await until(() => dom.window.document.querySelector('h1')?.textContent === 'Overview');
assert.equal(dom.window.document.querySelectorAll('a.navitem').length, 7);
assert.ok(dom.window.document.querySelector('.demo-banner')?.textContent.includes('Explicit demo mode'));
for (const title of ['Devices', 'Traffic', 'Network', 'Firewall', 'Events', 'System', 'Overview']) {
  const link = [...dom.window.document.querySelectorAll('a.navitem')].find(node => node.textContent === title);
  link.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  await until(() => dom.window.document.querySelector('h1')?.textContent === title);
}
assert.equal(networkRequests, 0);
assert.equal(dom.window.document.title, 'Overview · Lanrith console');
assert.equal(dom.window.document.querySelectorAll('[role="img"][aria-label="Lanrith"]').length, 1);
assert.deepEqual(errors, []);
dom.window.close();
console.log('Compiled Open Design preview boots at about:blank and navigates all seven pages without network requests.');
