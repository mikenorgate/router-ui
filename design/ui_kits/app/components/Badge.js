/* Generated from TypeScript. Edit the paired .ts source and rebuild. */
"use strict";
var RouterBadge = (() => {
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

  // ui_kits/app/components/Badge.ts
  var Badge_exports = {};
  __export(Badge_exports, {
    Badge: () => Badge,
    Icon: () => Icon,
    Mark: () => Mark,
    escape: () => escape
  });
  function escape(value) {
    return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function Badge(label, tone = "plain", id = "") {
    const symbol = { plain: "\u25CB", good: "\u2713", warn: "\u25B3", bad: "\xD7", unknown: "?" }[tone];
    return `<span class="badge ${tone}" ${id ? `data-od-id="${escape(id)}"` : ""}><span aria-hidden="true">${symbol}</span>${escape(label)}</span>`;
  }
  function Mark() {
    return `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M7 25V7h10v8h8v10H7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M7 16h10V7m0 9 8 9" stroke="currentColor" stroke-width="1.8"/><circle cx="17" cy="16" r="3" fill="currentColor"/></svg>`;
  }
  function Icon(name) {
    const p = { overview: "M3 3h6v6H3zm12 0h6v6h-6zM3 15h6v6H3zm12 0h6v6h-6z", devices: "M4 4h16v12H4zM8 20h8m-4-4v4", traffic: "M3 8h18m-5-4 5 4-5 4M21 16H3m5-4-5 4 5 4", network: "M12 3v6m0 6v6M3 12h6m6 0h6M9 9h6v6H9z", firewall: "M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6z", events: "M5 4h14v17H5zM8 9h8M8 13h8M8 17h5", system: "M4 6h16M4 12h16M4 18h16M9 3v6m7 0v6M8 15v6" };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${p[name] || p.devices}"/></svg>`;
  }
  return __toCommonJS(Badge_exports);
})();
