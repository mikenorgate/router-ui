import {build} from 'esbuild';
const components=['Badge','Brand','Sidebar','Metric','Chart','PolicyTable','Inspector','AuthPanel','App','PreviewCard'];
for (const name of components) await build({entryPoints:[`ui_kits/app/components/${name}.ts`],outfile:`ui_kits/app/components/${name}.js`,bundle:true,format:'iife',globalName:`Router${name}`,target:'es2022',minify:false,banner:{js:'/* Generated from TypeScript. Edit the paired .ts source and rebuild. */'}});
console.log(`Built ${components.length} local browser component bundles.`);
