import { TsConfigJson } from "get-tsconfig";
import ts from "typescript";
import { SourceMapInput } from "rolldown";

//#region src/tsc/index.d.ts
interface TscContext {
  programs: ts.Program[];
  files: Map<string, string>;
}
interface TscOptions {
  tsconfig?: string;
  tsconfigRaw: TsConfigJson;
  cwd: string;
  incremental: boolean;
  entries?: string[];
  id: string;
  vue?: boolean;
  context?: TscContext;
}
interface TscResult {
  code?: string;
  map?: SourceMapInput;
  error?: string;
}
declare function tscEmit(tscOptions: TscOptions): TscResult;
//#endregion
//#region src/tsc/worker.d.ts
declare const functions: {
  tscEmit: typeof tscEmit;
};
type TscFunctions = typeof functions;
//#endregion
export { TscFunctions };