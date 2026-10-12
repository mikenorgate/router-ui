import {AuthPanel,AccessStates} from "./AuthPanel.ts";
import {PreviewCard as specimen} from "./PreviewCard.ts";
export default {title:"Access/AuthPanel",parameters:{layout:"padded"}};
export const ProviderUnavailable={render:()=>specimen(AuthPanel())};
export const SessionAndPermissionErrors={render:()=>specimen(AccessStates())};
