import {readFile, readdir, writeFile, stat} from 'node:fs/promises';
import {dirname, join, resolve, isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

// Existing installed native primitives; no imports, project creation or DB writes.
// OD_DATA_DIR is the daemon's resolved root propagated into this agent process.
const cli = process.env.OD_BIN;
const dataRoot = process.env.OD_DATA_DIR;
assert(cli && dataRoot && isAbsolute(dataRoot), 'A daemon-provided absolute OD_DATA_DIR and OD_BIN are required; do not guess a registry root.');
const id = 'user:router-console-design-system';
const slug = id.slice('user:'.length);
const registryRoot = join(dataRoot, 'design-systems');
const nativeDir = dirname(cli);
const registry = await import(pathToFileURL(join(nativeDir, 'design-systems/index.js')).href);
const filesApi = await import(pathToFileURL(join(nativeDir, 'projects.js')).href);
const summaries = await registry.listDesignSystems(registryRoot, {idPrefix: 'user:', source: 'user', isEditable: true});
const before = summaries.find((s: {id: string}) => s.id === id);
assert(before?.id === id && before.projectId === process.env.OD_PROJECT_ID, 'The existing registry entry must still be linked to this workspace.');
const validation = JSON.parse(await readFile('context/validation.json', 'utf8'));
const audit = JSON.parse(await readFile('context/package-audit.json', 'utf8'));
assert(validation.status === 'pass' && !audit.errors.length && !audit.warnings.length, 'Validate and audit the concrete workspace before refreshing the registry.');
const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
assert(manifest.id === slug && manifest.registryId === id, 'Package slug or full registry identity changed.');
const roots = ['DESIGN.md', 'README.md', 'SKILL.md', 'manifest.json', 'components.manifest.json', 'tokens.css', 'colors_and_type.css', 'design-tokens.json', 'design-contract.md', 'implementation-handoff.md', 'router-console-system.html', 'components.html', 'package.json', 'pnpm-lock.yaml', 'tsconfig.json', 'storybook-config', 'scripts', 'assets', 'fonts', 'build', 'preview', 'ui_kits', 'context', 'docs', 'storybook'];
async function collect(path: string): Promise<string[]> {
  const info = await stat(path);
  if (!info.isDirectory()) return path.endsWith('.artifact.json') || ['context/registry-refresh.json','context/registry-verification.json'].includes(path) ? [] : [path];
  const entries = await readdir(path, {withFileTypes: true});
  return (await Promise.all(entries.filter(e => !e.name.startsWith('.')).map(e => collect(join(path, e.name))))).flat();
}
const files = (await Promise.all(roots.map(collect))).flat().sort();
assert(files.length > 100 && files.includes('fonts/manrope-variable.woff2'), 'Missing package assets.');
// Remove the single incorrectly normalized config from the first guarded attempt.
// Only remove it when it is the exact copy this task wrote; preserve other files.
try {
  const misplaced = await readFile(join(registryRoot, slug, 'storybook/main.ts'));
  if(misplaced.equals(await readFile('.storybook/main.ts')))await filesApi.deleteProjectFile(registryRoot, slug, 'storybook/main.ts');
} catch (error) {
  if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
}
const updated = await registry.updateUserDesignSystem(registryRoot, id, {
  title: 'Lanrith Console Design System',
  body: await readFile('DESIGN.md', 'utf8'),
  artifactMode: 'agent-managed',
  // Keep its current registry lifecycle; refreshing assets is not publishing.
});
assert(updated?.id === id && updated.projectId === before.projectId && updated.status === before.status, 'Existing identity, link and lifecycle must be preserved.');
const checks: {path: string; sha256: string}[] = [];
for (const file of files) {
  const bytes = await readFile(file);
  // This is the same bounded native writer used by the Design Files panel.
  // Its validated container/id arguments target only the existing registry folder.
  const written = await filesApi.writeProjectFile(registryRoot, slug, file, bytes);
  assert(written.name === file, `Native writer normalized a package path: ${file} → ${written.name}`);
  const registered = await readFile(resolve(registryRoot, slug, file));
  assert(bytes.equals(registered), `Registry bytes differ: ${file}`);
  checks.push({path: file, sha256: createHash('sha256').update(bytes).digest('hex')});
}
const after = (await registry.listDesignSystems(registryRoot, {idPrefix: 'user:', source: 'user', isEditable: true})).find((s: {id: string}) => s.id === id);
const registeredBody = await registry.readDesignSystem(registryRoot, id, {idPrefix: 'user:'});
assert(after.id === id && after.projectId === before.projectId && registeredBody === await readFile('DESIGN.md', 'utf8'), 'Registered canonical design differs.');
const result = {status: 'pass', id, projectId: after.projectId, lifecyclePreserved: after.status === before.status, nativeMechanism: ['updateUserDesignSystem', 'writeProjectFile'], filesVerified: checks.length, files: checks};
await writeFile('context/registry-refresh.json', JSON.stringify(result, null, 2) + '\n');
await filesApi.writeProjectFile(registryRoot, slug, 'context/registry-refresh.json', Buffer.from(JSON.stringify(result, null, 2) + '\n'));
console.log(JSON.stringify({status: result.status, id, projectId: after.projectId, lifecyclePreserved: result.lifecyclePreserved, filesVerified: checks.length}));
