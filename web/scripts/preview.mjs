import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
// The embedded renderer may have an about:blank URL. Select the allowed demo mode
// at build time rather than attempting to rewrite the parent frame's URL.
execFileSync(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'build', '--mode', 'design-preview', '--outDir', '.preview-dist'], {
  env: { ...process.env, VITE_DEMO_MODE: '1' }, stdio: 'inherit',
});
const dist = resolve('.preview-dist');
const assets = await readdir(resolve(dist, 'assets'));
const script = assets.find(file => /^index-.*\.js$/.test(file));
const cssFile = assets.find(file => /^index-.*\.css$/.test(file));
if (!script || !cssFile) throw new Error('Build the application before generating its preview.');
let css = await readFile(resolve(dist, 'assets', cssFile), 'utf8');
for (const font of assets.filter(file => file.endsWith('.woff2'))) {
  const bytes = await readFile(resolve(dist, 'assets', font));
  css = css.replaceAll(`./${font}`, `data:font/woff2;base64,${bytes.toString('base64')}`);
  css = css.replaceAll(`/assets/${font}`, `data:font/woff2;base64,${bytes.toString('base64')}`);
}
let js = await readFile(resolve(dist, 'assets', script), 'utf8');
for (const svg of assets.filter(file => file.endsWith('.svg'))) {
  const bytes = await readFile(resolve(dist, 'assets', svg));
  const dataUrl = `data:image/svg+xml;base64,${bytes.toString('base64')}`;
  for (const path of [`/assets/${svg}`, `./assets/${svg}`, `assets/${svg}`]) js = js.replaceAll(path, dataUrl);
}
js = js.replace(/<\/script/gi, '<\\/script');
const licences = await Promise.all(['OFL-sans.txt', 'OFL-mono.txt'].map(file => readFile(resolve('public/licenses', file), 'utf8')));
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Router Console · explicit demo preview</title><!-- Fonts: IBM Plex Sans and Mono.\n${licences.join('\n').replaceAll('-->', '-- >')} --><style>${css}</style></head><body><div id="root"></div><script type="module">${js}</script></body></html>`;
await writeFile(resolve('..', 'router-console-preview.html'), html);
console.log('Generated router-console-preview.html from the actual application build; explicit demo, hash routes, embedded local assets.');
