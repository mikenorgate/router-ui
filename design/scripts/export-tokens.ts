import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Export resolved themes, rather than treating dark overrides or compact density
// as additional declarations in a line-oriented stream.
const css = await readFile('tokens.css', 'utf8');
const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
const blocks = [...clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
function declarations(selector: string): Record<string, string> {
  const block = blocks.find(m => m[1].trim() === selector);
  if (!block) throw new Error(`Missing canonical selector: ${selector}`);
  return Object.fromEntries([...block[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
}
const light = declarations(':root');
const dark = {...light, ...declarations(':root[data-theme="dark"]')};
const brand = 'context/lanrith-brand/tokens/lanrith.css';
function tokenType(name: string, value: string): string {
  if (name.startsWith('--shadow-')) return 'shadow';
  if (/^(?:oklch|rgb)\(/.test(value)) return 'color';
  if (name.startsWith('--font-')) return 'fontFamily';
  if (name.startsWith('--text-')) return 'fontSize';
  if (name.startsWith('--leading-')) return 'lineHeight';
  if (name.startsWith('--space-')) return 'spacing';
  if (name.startsWith('--radius-')) return 'borderRadius';
  if (name.startsWith('--duration-')) return 'duration';
  if (name.startsWith('--ease-')) return 'easing';
  return 'sizing';
}
const tokens = Object.entries({light, dark}).flatMap(([theme, values]) => Object.entries(values).map(([name, value]) => ({
  name, value, type: tokenType(name, value), theme,
  confidence: 'observed',
  reason: 'Exact resolved value from canonical tokens.css. Brand anchors are provided; semantic derivatives and compact scales are documented in context/provenance.md.',
  sources: ['tokens.css', 'context/provenance.md', ...(tokenType(name, value) === 'color' ? [brand] : name.startsWith('--font-') ? ['manifest.json', name === '--font-mono' ? 'fonts/ibm-plex-mono-latin-400-normal.woff2' : 'context/lanrith-brand/assets/fonts/manrope-latin-variable.woff2'] : ['DESIGN.md'])],
})));
await writeFile('design-tokens.json', JSON.stringify({
  format: 'od-design-tokens/v1', schemaVersion: 1,
  source: {evidence: 'context/provenance.md', tokensCss: 'tokens.css', tokensCssSha256: createHash('sha256').update(css).digest('hex'), brandTokens: brand, brandCopy: 'context/lanrith-brand/copy/brand-copy.txt'},
  tokens,
}, null, 2) + '\n');
console.log(`Exported ${tokens.length} exact tokens across light and dark themes.`);
