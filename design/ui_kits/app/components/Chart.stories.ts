import {Chart} from "./Chart.ts";
import {PreviewCard as specimen} from "./PreviewCard.ts";
export default {title:"Measurements/Chart",parameters:{layout:"padded"}};
export const ThroughputWithGap={render:()=>specimen(Chart())};
export const LatencyWithGap={render:()=>specimen(Chart("latency"))};
export const HistoricalInterval={render:()=>specimen(Chart("throughput","60"))};
