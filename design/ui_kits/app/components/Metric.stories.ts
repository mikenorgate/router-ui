import {Metric} from "./Metric.ts";
import {PreviewCard as specimen} from "./PreviewCard.ts";
export default {title:"Measurements/Metric",parameters:{layout:"padded"}};
export const Latency={render:()=>specimen(Metric({label:"Gateway latency",value:"24",unit:"ms",change:"+3 ms vs previous interval",age:"Router probe · 09:29:30 UTC",id:"latency"}))};
export const SharedCounter={render:()=>specimen(Metric({label:"Shared rule counter",value:"1,284",unit:"matches",change:"Whole-rule aggregate",age:"No device attribution · 09:29:54 UTC",id:"shared"}))};
