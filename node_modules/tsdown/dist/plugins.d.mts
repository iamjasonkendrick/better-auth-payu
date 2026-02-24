import { ReportPlugin, ResolvedOptions } from "./config-DL8S79AB.mjs";
import { Plugin } from "rolldown";
import { PackageJson } from "pkg-types";

//#region src/features/external.d.ts
declare function ExternalPlugin(options: ResolvedOptions): Plugin;
/*
* Production deps should be excluded from the bundle
*/
//#endregion
//#region src/features/shebang.d.ts
declare function ShebangPlugin(cwd: string, name?: string, isMultiFormat?: boolean): Plugin;
//#endregion
//#region src/features/node-protocol.d.ts
/**
* The `node:` protocol was added in Node.js v14.18.0.
* @see https://nodejs.org/api/esm.html#node-imports
*/
declare function NodeProtocolPlugin(nodeProtocolOption: "strip" | true): Plugin;
//#endregion
export { ExternalPlugin, NodeProtocolPlugin, ReportPlugin, ShebangPlugin };