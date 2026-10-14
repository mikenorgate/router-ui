import {execFileSync} from 'node:child_process';import {readFile,writeFile,mkdir} from 'node:fs/promises';
// Native registry filenames and downloads omit hidden config directories.
// Preserve the workspace source while including a reproducible portable copy.
await mkdir('storybook-config',{recursive:true});
for(const name of ['main.ts','preview.ts']){
 let configuration:Buffer;
 try{configuration=await readFile(`.storybook/${name}`);}
 catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;configuration=await readFile(`storybook-config/${name}`);}
 await writeFile(`storybook-config/${name}`,configuration);
}
execFileSync('corepack',['pnpm','exec','storybook','build','-c','storybook-config','-o','storybook','--disable-telemetry'],{stdio:'inherit',env:{...process.env,STORYBOOK_DISABLE_TELEMETRY:'1'}});
const policy=`default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' data: blob:; frame-src 'self'; worker-src 'self' blob:;`;
for(const file of ['storybook/index.html','storybook/iframe.html']){const html=await readFile(file,'utf8');await writeFile(file,html.replace(/<head>/i,`<head><meta http-equiv="Content-Security-Policy" content="${policy}">`));}
console.log('Static Storybook restricts runtime requests to local assets.');
