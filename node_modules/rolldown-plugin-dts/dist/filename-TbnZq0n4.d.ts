//#region src/filename.d.ts
declare const RE_JS: RegExp;
declare const RE_TS: RegExp;
declare const RE_DTS: RegExp;
declare const RE_DTS_MAP: RegExp;
declare const RE_NODE_MODULES: RegExp;
declare const RE_CSS: RegExp;
declare const RE_VUE: RegExp;
declare function filename_js_to_dts(id: string): string;
declare function filename_ts_to_dts(id: string): string;
declare function filename_dts_to(id: string, ext: "js" | "ts"): string;
declare function isRelative(id: string): boolean;
//#endregion
export { RE_CSS, RE_DTS, RE_DTS_MAP, RE_JS, RE_NODE_MODULES, RE_TS, RE_VUE, filename_dts_to, filename_js_to_dts, filename_ts_to_dts, isRelative };