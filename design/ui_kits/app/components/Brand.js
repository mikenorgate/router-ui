/* Generated from TypeScript. Edit the paired .ts source and rebuild. */
"use strict";
var RouterBrand = (() => {
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

  // ui_kits/app/components/Brand.ts
  var Brand_exports = {};
  __export(Brand_exports, {
    Brand: () => Brand
  });

  // ui_kits/app/components/Badge.ts
  function escape(value) {
    return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  // ui_kits/app/components/Brand.ts
  function Brand({ assetBase = "../../assets/", variant = "wordmark", label = "Lanrith", id = "" } = {}) {
    const file = variant === "wordmark" ? "lanrith-wordmark" : "lanrith-mark";
    const size = variant === "wordmark" ? 'width="299.596" height="88"' : 'width="64" height="64"';
    return `<span class="brand-asset brand-asset-${variant}" role="img" aria-label="${escape(label)}" ${id ? `data-od-id="${escape(id)}"` : ""}><img class="brand-primary" src="${escape(assetBase + file)}.svg" ${size} alt="" aria-hidden="true"><img class="brand-reverse" src="${escape(assetBase + file)}-reverse.svg" ${size} alt="" aria-hidden="true"></span>`;
  }
  return __toCommonJS(Brand_exports);
})();
