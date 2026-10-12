import {escape} from './Badge.ts';
export type MetricProps={label:string,value:string,unit:string,change:string,age:string,id:string};
export function Metric(p:MetricProps):string{return `<dl class="metric" data-od-id="metric-${escape(p.id)}"><dt>${escape(p.label)}</dt><dd class="value">${escape(p.value)}<span class="unit">${escape(p.unit)}</span></dd><dd class="meta"><span>${escape(p.change)}</span><span class="muted" style="font-size:0.9em">${escape(p.age)}</span></dd></dl>`;}
