/* Generated from TypeScript. Edit the paired .ts source and rebuild. */
"use strict";
var RouterMetric = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // ui_kits/app/components/Metric.ts
  var Metric_exports = {};
  __export(Metric_exports, {
    Metric: () => Metric
  });

  // ui_kits/app/components/Badge.ts
  function escape(value) {
    return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  // ui_kits/app/components/Metric.ts
  function Metric(p) {
    return `<dl class="metric" data-od-id="metric-${escape(p.id)}"><dt>${escape(p.label)}</dt><dd class="value">${escape(p.value)}<span class="unit">${escape(p.unit)}</span></dd><dd class="meta"><span>${escape(p.change)}</span><span class="muted" style="font-size:0.9em">${escape(p.age)}</span></dd></dl>`;
  }
  return __toCommonJS(Metric_exports);
})();
