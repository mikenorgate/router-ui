import {Sidebar} from "./Sidebar.ts";
import {PreviewCard as specimen} from "./PreviewCard.ts";
export default {title:"Navigation/Sidebar",parameters:{layout:"padded"}};
export const Labelled={render:()=>specimen(Sidebar("Devices"))};
