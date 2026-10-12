import {Inspector,RuleDetail} from "./Inspector.ts";import {policies} from "./PolicyTable.ts";
import {PreviewCard as specimen} from "./PreviewCard.ts";
export default {title:"Policy/Inspector",parameters:{layout:"padded"}};
export const ObservedPath={render:()=>specimen(Inspector())};
export const StaleGrant={render:()=>specimen(RuleDetail(policies[2]))};
export const UnknownOrigin={render:()=>specimen(RuleDetail(policies[3]))};
