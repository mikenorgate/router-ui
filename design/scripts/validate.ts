import {readFile,writeFile,readdir} from 'node:fs/promises';import {resolve,dirname,extname,relative} from 'node:path';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';import {JSDOM, ResourceLoader, VirtualConsole} from 'jsdom';import {App,bindInteractions} from '../ui_kits/app/components/App.ts';import {Brand} from '../ui_kits/app/components/Brand.ts';
const errors:string[]=[];let checks=0;const check=(condition:boolean,message:string)=>{checks++;if(!condition)errors.push(message);};
const css=await readFile('tokens.css','utf8');
// Independent CSSOM oracle: no exporter implementation is imported here.
function cssThemes(text:string):Record<string,Record<string,string>> {
 const document=new JSDOM('<html><head></head><body></body></html>').window.document;
 const style=document.createElement('style');style.textContent=text;document.head.append(style);
 const base:Record<string,string>={},overrides:Record<string,string>={};
 for(const rule of Array.from(style.sheet!.cssRules)) {
  const r=rule as CSSStyleRule;
  if(!r.style)continue;
  const target=r.selectorText===':root'?base:r.selectorText?.replace(/"/g,'')===':root[data-theme=dark]'?overrides:null;
  if(target)for(let i=0;i<r.style.length;i++){const name=r.style[i];if(name.startsWith('--'))target[name]=r.style.getPropertyValue(name).trim();}
 }
 document.defaultView!.close();return {light:base,dark:{...base,...overrides}};
}
type ExportToken={name:string,value:string,theme:string,sources:string[],confidence:string};
const canonical=cssThemes(css);
const exported=JSON.parse(await readFile('design-tokens.json','utf8'));
function tokenDrift(tokens:ExportToken[]):string[] {
 const differences:string[]=[];
 for(const [theme,expected] of Object.entries(canonical)){
  const rows=tokens.filter(t=>t.theme===theme),actual=new Map(rows.map(t=>[t.name,t.value]));
  if(rows.length!==actual.size)differences.push(`${theme}: duplicate token`);
  for(const [name,value] of Object.entries(expected))if(actual.get(name)!==value)differences.push(`${theme} ${name}: expected ${value}, found ${actual.get(name)}`);
  for(const name of actual.keys())if(!(name in expected))differences.push(`${theme}: unexpected token ${name}`);
 }
 for(const t of tokens)if(!(t.theme in canonical))differences.push(`Unexpected theme ${t.theme}`);
 return differences;
}
check(exported.format==='od-design-tokens/v1','Structured token format');
for(const drift of tokenDrift(exported.tokens))check(false,`Structured/CSS drift: ${drift}`);
check(tokenDrift(exported.tokens).length===0,'Every exported value matches independently resolved canonical CSS in both themes');
check(exported.source.tokensCssSha256===createHash('sha256').update(css).digest('hex'),'Structured export canonical CSS checksum');
check(exported.tokens.every((t:ExportToken)=>t.sources.includes('tokens.css')&&t.sources.includes('context/provenance.md')&&t.confidence==='observed'),'Structured token provenance records exact observed canonical values');
check(canonical.light['--text-body']==='1rem','Approved readable 16px body retained');
for(const [theme,name,wrong] of [['light','--bg','oklch(0.975 0.005 95)'],['dark','--surface','oklch(0.245 0.011 250)'],['dark','--font-body','"IBM Plex Sans"'],['light','--text-body','0.9375rem']]){
 const mutated:ExportToken[]=structuredClone(exported.tokens);mutated.find(t=>t.theme===theme&&t.name===name)!.value=wrong;
 check(tokenDrift(mutated).length>0,`Drift detector rejects ${theme} ${name} regression`);
}
function rgb(value:string):number[]{const m=/oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/.exec(value);assert(m);const L=+m[1],C=+m[2],h=+m[3]*Math.PI/180,a=C*Math.cos(h),b=C*Math.sin(h);const l=(L+.3963377774*a+.2158037573*b)**3,mm=(L-.1055613458*a-.0638541728*b)**3,s=(L-.0894841775*a-1.291485548*b)**3;return [4.0767416621*l-3.3077115913*mm+.2309699292*s,-1.2684380046*l+2.6097574011*mm-.3413193965*s,-.0041960863*l-.7034186147*mm+1.707614701*s].map(x=>Math.max(0,Math.min(1,x)));}
function lum(value:string):number{const [r,g,b]=rgb(value);return .2126*r+.7152*g+.0722*b;}
function contrast(a:string,b:string):number{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
const block=(text:string)=>Object.fromEntries([...text.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m=>[m[1],m[2]]));
const light=block(css.split(':root[data-theme="dark"]')[0]),dark={...light,...block(css.split(':root[data-theme="dark"]')[1].split(':root[data-density')[0])};
const reports:{theme:string,foreground:string,background:string,ratio:number,target:number,pass:boolean}[]=[];
for(const [theme,t] of Object.entries({light,dark})){
 for(const fg of ['fg','muted','accent','success','warn','danger','unknown'])for(const bg of ['bg','surface','surface-raised'])reports.push({theme,foreground:fg,background:bg,ratio:contrast(t[fg],t[bg]),target:4.5,pass:contrast(t[fg],t[bg])>=4.5});
 for(const fg of ['accent','success','warn','danger','unknown'])reports.push({theme,foreground:fg,background:theme==='dark'?'surface':fg+'-soft',ratio:contrast(t[fg],t[theme==='dark'?'surface':fg+'-soft']),target:4.5,pass:contrast(t[fg],t[theme==='dark'?'surface':fg+'-soft'])>=4.5});
 for(const fg of [theme==='dark'?'muted':'control-border','accent','chart-primary','chart-secondary'])for(const bg of ['bg','surface','surface-raised'])reports.push({theme,foreground:fg,background:bg,ratio:contrast(t[fg],t[bg]),target:3,pass:contrast(t[fg],t[bg])>=3});
 for(const fg of [theme==='dark'?'muted':'control-border','chart-primary','chart-secondary'])reports.push({theme,foreground:fg,background:'chart-fill',ratio:contrast(t[fg],t['chart-fill']),target:3,pass:contrast(t[fg],t['chart-fill'])>=3});
 reports.push({theme,foreground:theme==='dark'?'muted':'control-border',background:'unknown-soft',ratio:contrast(t[theme==='dark'?'muted':'control-border'],t['unknown-soft']),target:3,pass:contrast(t[theme==='dark'?'muted':'control-border'],t['unknown-soft'])>=3});
 reports.push({theme,foreground:'on-accent',background:'accent',ratio:contrast(t['on-accent'],t.accent),target:4.5,pass:contrast(t['on-accent'],t.accent)>=4.5});
}
reports.forEach(r=>check(r.pass,`${r.theme} ${r.foreground}/${r.background}: ${r.ratio.toFixed(2)} < ${r.target}`));
await writeFile('context/contrast-report.json',JSON.stringify({method:'WCAG relative luminance; OKLCH → linear sRGB, gamut clipped before luminance',reports:reports.map(r=>({...r,ratio:+r.ratio.toFixed(3)})),scope:'Normal text 4.5, essential controls and series 3.0. Decorative dividers exempt. Large text uses the same foreground, so exceeds 3.0.'},null,2)+'\n');
async function walk(dir='.'):Promise<string[]>{let files:string[]=[];for(const e of await readdir(dir,{withFileTypes:true})){if(['node_modules','.tmp','.git','.agents','.codex','.file-versions','.live-artifacts','.od-skills'].includes(e.name))continue;const p=dir==='.'?e.name:dir+'/'+e.name;files=files.concat(e.isDirectory()?await walk(p):[p]);}return files;}
const files=await walk();const fileSet=new Set(files);let links=0;
for(const path of files.filter(x=>['.html','.css','.md'].includes(extname(x))&&!x.startsWith('docs/')&&!x.startsWith('context/application-')&&!x.endsWith('source-context.md'))){const text=await readFile(path,'utf8');const refs=extname(path)==='.html'?[...text.matchAll(/(?:href|src)="([^"]+)"/g)].map(x=>x[1]):extname(path)==='.css'?[...text.matchAll(/url\(["']?([^\)"']+)/g)].map(x=>x[1]):[...text.matchAll(/\]\(([^)]+)\)/g)].map(x=>x[1]);for(const ref of refs){if(/^(?:https?:|data:|mailto:|#)/.test(ref))continue;const clean=ref.split(/[?#]/)[0];if(!clean||clean.includes('${'))continue;const target=relative(resolve('.'),resolve(dirname(path),clean));links++;check(fileSet.has(target)||files.some(f=>f.startsWith(target+'/')),`Broken local reference ${path} → ${ref}`);}if(extname(path)==='.html')check(!/<(?:script|link|img)[^>]+(?:src|href)="https?:/i.test(text),`External runtime dependency in ${path}`);}
const manifest=JSON.parse(await readFile('manifest.json','utf8'));check(manifest.schemaVersion==='od-design-system-project/v1'&&manifest.id==='router-console-design-system'&&manifest.registryId==='user:router-console-design-system','Native manifest identity');for(const page of manifest.preview.pages)check(fileSet.has(page.path),'Missing manifest page '+page.path);
for(const name of ['Badge','Brand','Sidebar','Metric','Chart','PolicyTable','Inspector','AuthPanel','App','PreviewCard']){check(fileSet.has(`ui_kits/app/components/${name}.ts`),'Missing TS component '+name);check(fileSet.has(`ui_kits/app/components/${name}.stories.ts`),'Missing story '+name);check(fileSet.has(`ui_kits/app/components/${name}.js`),'Missing generated runtime '+name);}
for(const name of ['main.ts','preview.ts']){check(fileSet.has(`storybook-config/${name}`),`Portable Storybook configuration exists: ${name}`);if(fileSet.has(`.storybook/${name}`))check((await readFile(`storybook-config/${name}`)).equals(await readFile(`.storybook/${name}`)),`Portable Storybook configuration matches workspace source: ${name}`);}
const fontCss=await readFile('colors_and_type.css','utf8');
const manrope=manifest.fonts.find((f:{family:string})=>f.family==='Manrope');
check(manrope?.file==='fonts/manrope-variable.woff2'&&manrope?.weight==='200 800'&&manrope?.license==='fonts/OFL-manrope.txt','Manifest declares actual variable Manrope and separate licence');
check(!manifest.fonts.some((f:{family:string})=>f.family==='IBM Plex Sans'),'Current manifest excludes unused Plex Sans');
check(fontCss.includes('font-weight: 200 800')&&fontCss.includes('fonts/manrope-variable.woff2'),'Font CSS agrees with variable file and weight range');
for(const [copy,source] of [['fonts/manrope-variable.woff2','context/lanrith-brand/assets/fonts/manrope-latin-variable.woff2'],['fonts/OFL-manrope.txt','context/lanrith-brand/licenses/manrope-OFL.txt'],['assets/lanrith-wordmark.svg','context/lanrith-brand/assets/logo/lanrith-primary.svg'],['assets/lanrith-wordmark-reverse.svg','context/lanrith-brand/assets/logo/lanrith-reverse.svg'],['assets/lanrith-mark.svg','context/lanrith-brand/assets/logo/lanrith-mark-primary.svg'],['assets/lanrith-mark-reverse.svg','context/lanrith-brand/assets/logo/lanrith-mark-reverse.svg'],['assets/lanrith-favicon.svg','context/lanrith-brand/assets/logo/favicon.svg']])check((await readFile(copy)).equals(await readFile(source)),`Exact approved asset copy: ${copy}`);
const plexLicence=await readFile('fonts/OFL-plex-sans.txt','utf8');
check(plexLicence.includes('IBM Corp.')&&plexLicence.includes('IBMPlexSans')&&!plexLicence.includes('Manrope'),'Retained Plex Sans binaries carry their own OFL');
check((await readFile('fonts/OFL-sans.txt')).equals(await readFile('fonts/OFL-plex-sans.txt')),'Legacy Sans licence alias remains correct');
for(const [path,hash] of Object.entries(JSON.parse(await readFile('context/evidence-checksums.json','utf8'))))check(createHash('sha256').update(await readFile(path)).digest('hex')===hash,`Historical evidence unchanged: ${path}`);
const renderedPages=files.filter(f=>f.endsWith('.html')&&!f.startsWith('storybook/'));
for(const path of renderedPages){
 const d=new JSDOM(await readFile(path,'utf8')).window.document;
 for(const style of d.querySelectorAll('style,[style]'))check(!/--(?:bg|surface|fg|muted|accent|border|font-body|text-body)\s*:/.test(style.textContent+' '+style.getAttribute('style')),`${path}: inline canonical token override`);
 check(!!d.querySelector('link[href$="colors_and_type.css"]'),`${path}: canonical local CSS entry`);
 for(const img of d.querySelectorAll('img[src]'))check(!/^https?:/.test(img.getAttribute('src')!),`${path}: local image asset`);
 d.defaultView!.close();
}
const normalizeCss=(value:string)=>value.replace(/"/g,'').replace(/(\d*\.?\d+)ms/g,(_,n)=>String(Number(n)/1000)+'s').replace(/\d*\.\d+/g,n=>String(Number(n))).replace(/\s+/g,'');
const compiledCss=files.filter(f=>/^storybook\/assets\/.*\.css$/.test(f));
check(compiledCss.length>0,'Rebuilt Storybook stylesheet exists');
for(const path of compiledCss){const themes=cssThemes(await readFile(path,'utf8'));if(Object.keys(themes.light).length)for(const [theme,values] of Object.entries(canonical))for(const [name,value] of Object.entries(values))check(normalizeCss(themes[theme][name]||'')===normalizeCss(value),`${path}: ${theme} ${name} matches canonical CSS`);}
const dom=new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>',{url:'https://router.example/ui_kits/app/device-firewall.html',pretendToBeVisual:true});const w=dom.window;
for(const key of ['window','document','localStorage','location','HTMLElement','HTMLInputElement','HTMLSelectElement','HTMLFormElement','HTMLDialogElement'])Object.defineProperty(globalThis,key,{value:(w as unknown as Record<string,unknown>)[key],configurable:true});Object.defineProperty(globalThis,'navigator',{value:w.navigator,configurable:true});
(w.HTMLDialogElement.prototype as unknown as {showModal:()=>void}).showModal=function(this:HTMLDialogElement){this.setAttribute('open','');};(w.HTMLDialogElement.prototype as unknown as {close:()=>void}).close=function(this:HTMLDialogElement){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
let root=w.document.getElementById('app')!;root.innerHTML=App('device');bindInteractions(root);
const q=<T extends HTMLElement=HTMLElement>(s:string)=>root.querySelector<T>(s)!;
q('[data-theme-toggle]').click();check(w.document.documentElement.dataset.theme==='dark','Theme switches to neutral dark');check(w.localStorage.getItem('router-console-theme')==='dark','Theme preference persists locally');
const input=q<HTMLInputElement>('[data-policy-search]');input.value='POL-042';input.dispatchEvent(new w.Event('input',{bubbles:true}));check(root.querySelectorAll('[data-rule]').length===1,'Policy filter isolates a rule');
q('[data-inspect="POL-042"]').click();check(q('#policy-dialog').hasAttribute('open'),'Inspector opens');check(q('[data-rule-detail]').textContent!.includes('Configuration'),'Provenance shows source');check(w.document.activeElement===q('[data-close-inspector]'),'Inspector receives focus');q('[data-close-inspector]').click();check(w.document.activeElement===q('[data-inspect="POL-042"]'),'Inspector returns focus');
input.value='no-such-rule';input.dispatchEvent(new w.Event('input',{bubbles:true}));check(q('[data-policy-rows]').textContent!.includes('No matching rules'),'Empty result state');q('[data-clear-filter]').click();check(root.querySelectorAll('[data-rule]').length===4,'Clear filter restores bounded rows');
q('[data-sort-policy]').click();check(q('[data-rule]').dataset.rule==='POL-211','Policy sort changes row order');check(q<HTMLSelectElement>('[data-policy-order]').value==='desc','Mobile rule order reflects desktop sorting');check(q('[data-sort-policy]').closest('th')!.getAttribute('aria-sort')==='descending','Sort state exposed');
const evidence=q<HTMLSelectElement>('[data-policy-filter]');evidence.value='unknown';evidence.dispatchEvent(new w.Event('change',{bubbles:true}));check(root.querySelectorAll('[data-rule]').length===2,'Unknown/stale filter');
q('[data-tab="firewall"]').focus();q('[role="tablist"]').dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));check(q('[data-tab="addresses"]').getAttribute('aria-selected')==='true'&&!q('#panel-addresses').hidden,'Arrow-key tab selects and reveals panel');q('[data-tab="firewall"]').click();
q<HTMLFormElement>('[data-simulation]').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));check(q('[data-sim-result]').textContent!.startsWith('Simulated fixture outcome'),'Simulation labelled');
root.replaceWith(w.document.createElement('div'));root=w.document.body.lastElementChild as HTMLElement;root.innerHTML=App('auth');bindInteractions(root);q<HTMLFormElement>('[data-recovery-form]').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));check(q('[data-recovery-result]').textContent!.includes('Enter the provisioned'),'Local recovery validates missing fields');check(q('[name="account"]').getAttribute('aria-invalid')==='true','Invalid account is accessible');q<HTMLInputElement>('[name="account"]').value='fictional-recovery';q<HTMLInputElement>('[name="password"]').value='illustrative-only';q<HTMLFormElement>('[data-recovery-form]').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));check(q('[data-recovery-result]').textContent!.includes('No authentication request'),'Recovery is a local example');check(q<HTMLInputElement>('[name="password"]').value==='','Password cleared');check(!Object.keys(w.localStorage).some(k=>/password|token|session/.test(k)),'No credentials persisted');
root.replaceWith(w.document.createElement('div'));root=w.document.body.lastElementChild as HTMLElement;root.innerHTML=App('overview');bindInteractions(root);const range=q<HTMLSelectElement>('[data-time-range]');range.value='60';range.dispatchEvent(new w.Event('change',{bubbles:true}));check([...root.querySelectorAll('[data-charts],[data-charts-1],[data-charts-2]')].some(e=>e.textContent!.includes('08:30')),'Time selector loads different labelled fixture');
for(const page of ['reference','overview','device','flow','auth'] as const){const d=new JSDOM(App(page)).window.document;for(const anchor of d.querySelectorAll('a[href]')){const href=anchor.getAttribute('href')!;if(href.startsWith('#'))continue;const target=relative(resolve('.'),resolve('ui_kits/app',href.split(/[?#]/)[0]));check(fileSet.has(target),`${page}: broken rendered link ${href}`);links++;}const ids=[...d.querySelectorAll('[id]')].map(e=>e.id);check(new Set(ids).size===ids.length,`${page}: duplicate HTML ids`);const od=[...d.querySelectorAll('[data-od-id]')].map(e=>e.getAttribute('data-od-id'));check(new Set(od).size===od.length,`${page}: duplicate inspectable ids`);for(const control of d.querySelectorAll('input,select,textarea'))check(!!control.getAttribute('aria-label')||!!control.getAttribute('aria-labelledby')||!!control.closest('label'),`${page}: unlabelled control`);check(d.querySelectorAll('main h1').length===1,`${page}: one page heading`);}
// Load every real non-Storybook HTML surface with networking disabled. Generated
// runtime, imports, local assets and hydration must all work without a server/CDN.
const externalRequests:string[]=[],runtimeErrors:string[]=[];
class LocalOnly extends ResourceLoader {
 override fetch(url:string,options: Parameters<ResourceLoader['fetch']>[1]) {
  if(new URL(url).hostname!=='local.lanrith.example'){externalRequests.push(url);return null;}
  const p=decodeURIComponent(new URL(url).pathname).slice(1);
  const request=readFile(resolve(p)) as ReturnType<ResourceLoader['fetch']>;
  if(request)request.abort=()=>{};
  return request;
 }
}
for(const path of renderedPages){
 const virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',e=>runtimeErrors.push(`${path}: ${e.message}`));
 const d=new JSDOM(await readFile(path,'utf8'),{url:`https://local.lanrith.example/${path}`,runScripts:'dangerously',resources:new LocalOnly(),virtualConsole,pretendToBeVisual:true});
 await new Promise<void>(resolve=>d.window.addEventListener('load',()=>resolve(),{once:true}));
 for(const width of [1280,375])for(const theme of ['light','dark']){
  Object.defineProperty(d.window,'innerWidth',{value:width,configurable:true});
  const button=d.window.document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
  if(d.window.document.documentElement.dataset.theme!==theme)button?.click();
  if(button)check(d.window.document.documentElement.dataset.theme===theme,`${path}: ${width}px ${theme} theme interaction works offline`);
  for(const asset of d.window.document.querySelectorAll('.brand-asset')){
   check(asset.getAttribute('role')==='img'&&!!asset.getAttribute('aria-label'),`${path}: ${theme} brand has one accessible name`);
   check(!!asset.querySelector('.brand-primary')&&!!asset.querySelector('.brand-reverse'),`${path}: both approved theme variants available offline`);
  }
 }
 check(!d.window.document.body.textContent?.includes('Loading local'),`${path}: generated composition hydrated`);
 d.window.close();
}
check(externalRequests.length===0,`Offline runtime external requests: ${externalRequests.join(', ')}`);
check(runtimeErrors.length===0,`Offline runtime errors: ${runtimeErrors.join(', ')}`);
for(const variant of ['wordmark','mark'] as const){const d=new JSDOM(Brand({variant})).window.document;check(d.querySelectorAll('[role="img"]').length===1,`${variant}: single named identity`);check(!d.querySelector('svg,text'),`${variant}: exact local asset, no redrawn geometry`);d.defaultView!.close();}
const result={status:errors.length?'fail':'pass',checks,contrastPairs:reports.length,localReferences:links,componentsWithStories:10,renderedSurfaces:renderedPages.length,themes:['light','dark'],viewportBehaviorChecks:[1280,375],externalRuntimeRequests:externalRequests,structuredTokenDriftControls:4,interactionChecks:'Theme persistence, filters/empty/sort, modal focus/return, keyboard tabs, labelled simulation, recovery validation/no storage, selected chart interval; every generated HTML hydrated offline in both themes',sourceEvidence:'Copied source document SHA-256 checksums unchanged.',limitations:'CSSOM consistency, static layout rules and jsdom behavior do not measure pixel overflow or replace assistive-technology review. Native OD visual-export evidence is recorded separately.',errors};await writeFile('context/validation.json',JSON.stringify(result,null,2)+'\n');dom.window.close();console.log(JSON.stringify(result,null,2));if(errors.length)process.exitCode=1;
