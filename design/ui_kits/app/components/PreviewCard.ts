import {bindInteractions} from './App.ts';
export function PreviewCard(html:string):HTMLElement {
 const e=document.createElement('div');e.innerHTML=html+'<div class="toast" data-toast role="status" hidden></div>';bindInteractions(e);
 const stories:Record<string,string>={'index.html':'reference','overview.html':'overview','device-firewall.html':'device-firewall','flow-inspector.html':'flow-provenance','access-states.html':'authentication'};
 for(const img of e.querySelectorAll<HTMLImageElement>('img[src^="../../assets/"]')) img.setAttribute('src','./assets/'+img.getAttribute('src')!.slice('../../assets/'.length));
 for(const a of e.querySelectorAll<HTMLAnchorElement>('a[href]')){
  const href=a.getAttribute('href')!;if(href.startsWith('#'))continue;
  if(stories[href.split('#')[0]]){a.href=`./index.html?path=/story/compositions-app--${stories[href.split('#')[0]]}`;a.target='_parent';}
  else if(href.startsWith('../../'))a.href='../'+href.slice(6);
 }
 return e;
}
