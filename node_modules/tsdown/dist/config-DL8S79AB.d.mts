import "ansis";
import { BuildOptions, ExternalOption, InputOption, InputOptions, InternalModuleFormat, MinifyOptions, ModuleFormat, OutputAsset, OutputChunk, OutputOptions, Plugin } from "rolldown";
import { Hookable } from "hookable";
import { CheckPackageOptions } from "@arethetypeswrong/core";
import { Options } from "publint";
import { Options as Options$1 } from "rolldown-plugin-dts";
import { Options as Options$2 } from "unplugin-unused";
import { PackageJson } from "pkg-types";

//#region src/utils/types.d.ts
type Overwrite<T, U> = Omit<T, keyof U> & U;
type Awaitable<T> = T | Promise<T>;
type MarkPartial<T, K extends keyof T> = Omit<Required<T>, K> & Partial<Pick<T, K>>;
type Arrayable<T> = T | T[];
//#endregion
//#region src/features/attw.d.ts
interface AttwOptions extends CheckPackageOptions {
  /**
  * Profiles select a set of resolution modes to require/ignore. All are evaluated but failures outside
  * of those required are ignored.
  *
  * The available profiles are:
  * - `strict`: requires all resolutions
  * - `node16`: ignores node10 resolution failures
  * - `esmOnly`: ignores CJS resolution failures
  *
  * @default 'strict'
  */
  profile?: "strict" | "node16" | "esmOnly";
  /**
  * The level of the check.
  *
  * The available levels are:
  * - `error`: fails the build
  * - `warn`: warns the build
  *
  * @default 'warn'
  */
  level?: "error" | "warn";
}
//#endregion
//#region src/features/copy.d.ts
interface CopyEntry {
  from: string;
  to: string;
}
type CopyOptions = Arrayable<string | CopyEntry>;
type CopyOptionsFn = (options: ResolvedOptions) => Awaitable<CopyOptions>;
//#endregion
//#region src/utils/logger.d.ts
declare class Logger {
  silent: boolean;
  setSilent(value: boolean): void;
  filter(...args: any[]): any[];
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  success(...args: any[]): void;
}
declare const logger: Logger;
//#endregion
//#region src/features/hooks.d.ts
interface BuildContext {
  options: ResolvedOptions;
  hooks: Hookable<TsdownHooks>;
}
interface RolldownContext {
  buildOptions: BuildOptions;
}
/**
* Hooks for tsdown.
*/
interface TsdownHooks {
  /**
  * Invoked before each tsdown build starts.
  * Use this hook to perform setup or preparation tasks.
  */
  "build:prepare": (ctx: BuildContext) => void | Promise<void>;
  /**
  * Invoked before each Rolldown build.
  * For dual-format builds, this hook is called for each format.
  * Useful for configuring or modifying the build context before bundling.
  */
  "build:before": (ctx: BuildContext & RolldownContext) => void | Promise<void>;
  /**
  * Invoked after each tsdown build completes.
  * Use this hook for cleanup or post-processing tasks.
  */
  "build:done": (ctx: BuildContext) => void | Promise<void>;
}
//#endregion
//#region src/index.d.ts
/**
* Build with tsdown.
*/
declare function build$1(userOptions?: Options$3): Promise<void>;
declare const pkgRoot: string;
type TsdownChunks = Partial<Record<NormalizedFormat, Array<OutputChunk | OutputAsset>>>;
/**
* Build a single configuration, without watch and shortcuts features.
*
* Internal API, not for public use
*
* @private
* @param config Resolved options
*/
declare function buildSingle(config: ResolvedOptions, clean: () => Promise<void>): Promise<(() => Promise<void>) | undefined>;
//#endregion
//#region src/features/exports.d.ts
interface ExportsOptions {
  /**
  * Generate exports that link to source code during development.
  * - string: add as a custom condition.
  * - true: all conditions point to source files, and add dist exports to `publishConfig`.
  */
  devExports?: boolean | string;
  /**
  * Exports for all files.
  */
  all?: boolean;
  customExports?: (exports: Record<string, any>, context: {
    pkg: PackageJson;
    chunks: TsdownChunks;
    outDir: string;
    isPublish: boolean;
  }) => Awaitable<Record<string, any>>;
}
//#endregion
//#region src/utils/package.d.ts
type PackageType = "module" | "commonjs" | undefined;
//#endregion
//#region src/features/output.d.ts
interface OutExtensionContext {
  options: InputOptions;
  format: NormalizedFormat;
  /** "type" field in project's package.json */
  pkgType?: PackageType;
}
interface OutExtensionObject {
  js?: string;
  dts?: string;
}
type OutExtensionFactory = (context: OutExtensionContext) => OutExtensionObject | undefined;
//#endregion
//#region src/features/report.d.ts
interface ReportOptions {
  /**
  * Enable/disable brotli-compressed size reporting.
  * Compressing large output files can be slow, so disabling this may increase build performance for large projects.
  *
  * @default false
  */
  brotli?: boolean;
  /**
  * Skip reporting compressed size for files larger than this size.
  * @default 1_000_000 // 1MB
  */
  maxCompressSize?: number;
}
declare function ReportPlugin(options: ReportOptions, cwd: string, cjsDts?: boolean, name?: string, isMultiFormat?: boolean): Plugin;
//#endregion
//#region src/options/types.d.ts
type Sourcemap = boolean | "inline" | "hidden";
type Format = ModuleFormat;
type NormalizedFormat = InternalModuleFormat;
type ModuleTypes = Record<string, "js" | "jsx" | "ts" | "tsx" | "json" | "text" | "base64" | "dataurl" | "binary" | "empty" | "css" | "asset">;
interface Workspace {
  /**
  * Workspace directories. Glob patterns are supported.
  * - `auto`: Automatically detect `package.json` files in the workspace.
  * @default 'auto'
  */
  include?: Arrayable<string> | "auto";
  /**
  * Exclude directories from workspace.
  * Defaults to all `node_modules`, `dist`, `test`, `tests`, `temp`, and `tmp` directories.
  */
  exclude?: Arrayable<string>;
  /**
  * Path to the workspace configuration file.
  */
  config?: boolean | string;
}
/**
* Options for tsdown.
*/
interface Options$3 {
  /// build options
  /**
  * Defaults to `'src/index.ts'` if it exists.
  */
  entry?: InputOption;
  external?: ExternalOption;
  noExternal?: Arrayable<string | RegExp> | ((id: string, importer: string | undefined) => boolean | null | undefined | void);
  alias?: Record<string, string>;
  tsconfig?: string | boolean;
  /**
  * Specifies the target runtime platform for the build.
  *
  * - `node`: Node.js and compatible runtimes (e.g., Deno, Bun).
  *   For CJS format, this is always set to `node` and cannot be changed.
  * - `neutral`: A platform-agnostic target with no specific runtime assumptions.
  * - `browser`: Web browsers.
  *
  * @default 'node'
  * @see https://tsdown.dev/options/platform
  */
  platform?: "node" | "neutral" | "browser";
  inputOptions?: InputOptions | ((options: InputOptions, format: NormalizedFormat) => Awaitable<InputOptions | void | null>);
  /// output options
  /** @default ['es'] */
  format?: Format | Format[];
  globalName?: string;
  /** @default 'dist' */
  outDir?: string;
  /** @default false */
  sourcemap?: Sourcemap;
  /**
  * Clean directories before build.
  *
  * Default to output directory.
  * @default true
  */
  clean?: boolean | string[];
  /** @default false */
  minify?: boolean | "dce-only" | MinifyOptions;
  /**
  * Specifies the compilation target environment(s).
  *
  * Determines the JavaScript version or runtime(s) for which the code should be compiled.
  * If not set, defaults to the value of `engines.node` in your project's `package.json`.
  *
  * Accepts a single target (e.g., `'es2020'`, `'node18'`) or an array of targets.
  *
  * @see {@link https://tsdown.dev/options/target#supported-targets} for a list of valid targets and more details.
  *
  * @example
  * ```jsonc
  * // Target a single environment
  * { "target": "node18" }
  * ```
  *
  * @example
  * ```jsonc
  * // Target multiple environments
  * { "target": ["node18", "es2020"] }
  * ```
  */
  target?: string | string[] | false;
  /**
  * Determines whether unbundle mode is enabled.
  * When set to true, the output files will mirror the input file structure.
  * @default false
  */
  unbundle?: boolean;
  /**
  * @deprecated Use `unbundle` instead.
  * @default true
  */
  bundle?: boolean;
  define?: Record<string, string>;
  /** @default false */
  shims?: boolean;
  /**
  * The name to show in CLI output. This is useful for monorepos or workspaces.
  * Defaults to the package name from `package.json`.
  */
  name?: string;
  /**
  * Use a fixed extension for output files.
  * The extension will always be `.cjs` or `.mjs`.
  * Otherwise, it will depend on the package type.
  * @default false
  */
  fixedExtension?: boolean;
  /**
  * Custom extensions for output files.
  * `fixedExtension` will be overridden by this option.
  */
  outExtensions?: OutExtensionFactory;
  outputOptions?: OutputOptions | ((options: OutputOptions, format: NormalizedFormat) => Awaitable<OutputOptions | void | null>);
  /** @default true */
  treeshake?: boolean;
  plugins?: InputOptions["plugins"];
  /**
  * Sets how input files are processed.
  * For example, use 'js' to treat files as JavaScript or 'base64' for images.
  * Lets you import or require files like images or fonts.
  * @example
  * ```json
  * { '.jpg': 'asset', '.png': 'base64' }
  * ```
  */
  loader?: ModuleTypes;
  /** @default false */
  silent?: boolean;
  /**
  * Config file path
  */
  config?: boolean | string;
  /** @default false */
  watch?: boolean | string | string[];
  ignoreWatch?: string | string[];
  /**
  * You can specify command to be executed after a successful build, specially useful for Watch mode
  */
  onSuccess?: string | ((config: ResolvedOptions, signal: AbortSignal) => void | Promise<void>);
  /**
  * Skip bundling `node_modules`.
  * @default false
  */
  skipNodeModulesBundle?: boolean;
  /**
  * Reuse config from Vite or Vitest (experimental)
  * @default false
  */
  fromVite?: boolean | "vitest";
  /// addons
  /**
  * Emit TypeScript declaration files (.d.ts).
  *
  * By default, this feature is auto-detected based on the presence of the `types` field in the `package.json` file.
  * - If the `types` field is present in `package.json`, declaration file emission is enabled.
  * - If the `types` field is absent, declaration file emission is disabled by default.
  */
  dts?: boolean | Options$1;
  /**
  * Enable unused dependencies check with `unplugin-unused`
  * Requires `unplugin-unused` to be installed.
  * @default false
  */
  unused?: boolean | Options$2;
  /**
  * Run publint after bundling.
  * Requires `publint` to be installed.
  * @default false
  */
  publint?: boolean | Options;
  /**
  * Run `arethetypeswrong` after bundling.
  * Requires `@arethetypeswrong/core` to be installed.
  *
  * @default false
  * @see https://github.com/arethetypeswrong/arethetypeswrong.github.io
  */
  attw?: boolean | AttwOptions;
  /**
  * Enable size reporting after bundling.
  * @default true
  */
  report?: boolean | ReportOptions;
  /**
  * **[experimental]** Generate package exports for `package.json`.
  *
  * This will set the `main`, `module`, `types`, `exports` fields in `package.json`
  * to point to the generated files.
  */
  exports?: boolean | ExportsOptions;
  /**
  * Compile-time env variables.
  * @example
  * ```json
  * {
  *   "DEBUG": true,
  *   "NODE_ENV": "production"
  * }
  * ```
  */
  env?: Record<string, any>;
  /**
  * @deprecated Alias for `copy`, will be removed in the future.
  */
  publicDir?: CopyOptions | CopyOptionsFn;
  /**
  * Copy files to another directory.
  * @example
  * ```ts
  * [
  *   'src/assets',
  *   { from: 'src/assets', to: 'dist/assets' },
  * ]
  * ```
  */
  copy?: CopyOptions | CopyOptionsFn;
  hooks?: Partial<TsdownHooks> | ((hooks: Hookable<TsdownHooks>) => Awaitable<void>);
  /**
  * If enabled, strips the `node:` protocol prefix from import source.
  *
  * @default false
  * @deprecated Use `nodeProtocol: 'strip'` instead.
  *
  * @example
  * // With removeNodeProtocol enabled:
  * import('node:fs'); // becomes import('fs')
  */
  removeNodeProtocol?: boolean;
  /**
  * - If true, add `node:` prefix to built-in modules.
  * - If 'strip', strips the `node:` protocol prefix from import source.
  * - If false, does not modify the import source.
  *
  * @default false
  *
  * @example
  * // With nodeProtocol enabled:
  * import('fs'); // becomes import('node:fs')
  * // With nodeProtocol set to 'strip':
  * import('node:fs'); // becomes import('fs')
  * // With nodeProtocol set to false:
  * import('node:fs'); // remains import('node:fs')
  *
  */
  nodeProtocol?: "strip" | boolean;
  /**
  * If enabled, appends hash to chunk filenames.
  * @default true
  */
  hash?: boolean;
  /**
  * The working directory of the config file.
  * - Defaults to `process.cwd()` for root config.
  * - Defaults to the package directory for workspace config.
  */
  cwd?: string;
  /**
  * **[experimental]** Enable workspace mode.
  * This allows you to build multiple packages in a monorepo.
  */
  workspace?: Workspace | Arrayable<string> | true;
  /**
  * Filter workspace packages. This option is only available in workspace mode.
  */
  filter?: RegExp | string | string[];
}
/**
* Options without specifying config file path.
*/
type UserConfig = Arrayable<Omit<Options$3, "config" | "filter">>;
type UserConfigFn = (cliOptions: Options$3) => Awaitable<UserConfig>;
type ResolvedOptions = Omit<Overwrite<MarkPartial<Omit<Options$3, "publicDir" | "workspace" | "filter">, "globalName" | "inputOptions" | "outputOptions" | "minify" | "define" | "alias" | "external" | "noExternal" | "onSuccess" | "fixedExtension" | "outExtensions" | "hooks" | "removeNodeProtocol" | "copy" | "loader" | "name" | "bundle">, {
  format: NormalizedFormat[];
  target?: string[];
  clean: string[];
  dts: false | Options$1;
  report: false | ReportOptions;
  tsconfig: string | false;
  pkg?: PackageJson;
  exports: false | ExportsOptions;
  nodeProtocol: "strip" | boolean;
}>, "config" | "fromVite">;
//#endregion
//#region src/config.d.ts
/**
* Defines the configuration for tsdown.
*/
declare function defineConfig(options: UserConfig | UserConfigFn): UserConfig | UserConfigFn;
//#endregion
export { BuildContext, Options$3 as Options, ReportPlugin, ResolvedOptions, TsdownChunks, TsdownHooks, UserConfig, UserConfigFn, build$1 as build, buildSingle, defineConfig, logger, pkgRoot };