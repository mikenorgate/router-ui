import {PolicyTable} from "./PolicyTable.ts"; import {InspectionDialog} from "./Inspector.ts";
import {PreviewCard as specimen} from "./PreviewCard.ts";
export default {title:"Policy/PolicyTable",parameters:{layout:"padded"}};
export const EvidenceRows={render:()=>specimen(PolicyTable()+InspectionDialog())};
export const Empty={render:()=>specimen(PolicyTable([]))};
