import {Badge} from "./Badge.ts";
import {PreviewCard as specimen} from "./PreviewCard.ts";
export default {title:"Evidence/Badge",parameters:{layout:"padded"}};
export const Installed={render:()=>specimen(Badge("Installed"))};
export const Applicable={render:()=>specimen(Badge("Applicable"))};
export const ObservedMatch={render:()=>specimen(Badge("Observed match"))};
export const Stale={render:()=>specimen(Badge("Stale evidence","warn"))};
export const Unknown={render:()=>specimen(Badge("Origin unavailable","unknown"))};
export const ObservedDenial={render:()=>specimen(Badge("Observed denial","bad"))};
