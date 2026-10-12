import {App} from "./App.ts";
import {PreviewCard as specimen} from "./PreviewCard.ts";
export default {title:"Compositions/App",parameters:{layout:"fullscreen"}};
export const Reference={render:()=>specimen(App("reference"))};
export const Overview={render:()=>specimen(App("overview"))};
export const DeviceFirewall={render:()=>specimen(App("device"))};
export const FlowProvenance={render:()=>specimen(App("flow"))};
export const Authentication={render:()=>specimen(App("auth"))};
