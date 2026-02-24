import { defineConfig } from "./config-CzjtjH-U.mjs";
import { ExternalPlugin, NodeProtocolPlugin, ReportPlugin, ShebangPlugin, fsCopy, fsExists, fsRemove, fsStat, lowestCommonAncestor } from "./plugins-BsFgA-ka.mjs";
import { debounce, generateColor, logger, prettyName, resolveComma, resolveRegex, slash, toArray } from "./logger-CdK2zFTY.mjs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { blue, bold, dim, green, underline } from "ansis";
import { build as build$1 } from "rolldown";
import { exec } from "tinyexec";
import child_process from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import debug from "debug";
import { glob } from "tinyglobby";
import { RE_DTS } from "rolldown-plugin-dts/filename";
import { createHooks } from "hookable";
import { up } from "empathic/package";
import readline from "node:readline";
import minVersion from "semver/ranges/min-version.js";
import { up as up$1 } from "empathic/find";
import { loadConfig } from "unconfig";

//#region src/features/attw.ts
const debug$5 = debug("tsdown:attw");
const exec$1 = promisify(child_process.exec);
/**
* ATTW profiles.
* Defines the resolution modes to ignore for each profile.
*
* @see https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/packages/cli/README.md#profiles
*/
const profiles = {
	strict: [],
	node16: ["node10"],
	esmOnly: ["node10", "node16-cjs"]
};
/**
* Format an ATTW problem for display
*/
function formatProblem(problem) {
	const resolutionKind = "resolutionKind" in problem ? ` (${problem.resolutionKind})` : "";
	const entrypoint = "entrypoint" in problem ? ` at ${problem.entrypoint}` : "";
	switch (problem.kind) {
		case "NoResolution": return `  ❌ No resolution${resolutionKind}${entrypoint}`;
		case "UntypedResolution": return `  ⚠️  Untyped resolution${resolutionKind}${entrypoint}`;
		case "FalseESM": return `  🔄 False ESM: Types indicate ESM (${problem.typesModuleKind}) but implementation is CJS (${problem.implementationModuleKind})\n     Types: ${problem.typesFileName} | Implementation: ${problem.implementationFileName}`;
		case "FalseCJS": return `  🔄 False CJS: Types indicate CJS (${problem.typesModuleKind}) but implementation is ESM (${problem.implementationModuleKind})\n     Types: ${problem.typesFileName} | Implementation: ${problem.implementationFileName}`;
		case "CJSResolvesToESM": return `  ⚡ CJS resolves to ESM${resolutionKind}${entrypoint}`;
		case "NamedExports": {
			const missingExports = problem.missing?.length > 0 ? ` Missing: ${problem.missing.join(", ")}` : "";
			const allMissing = problem.isMissingAllNamed ? " (all named exports missing)" : "";
			return `  📤 Named exports problem${allMissing}${missingExports}\n     Types: ${problem.typesFileName} | Implementation: ${problem.implementationFileName}`;
		}
		case "FallbackCondition": return `  🎯 Fallback condition used${resolutionKind}${entrypoint}`;
		case "FalseExportDefault": return `  🎭 False export default\n     Types: ${problem.typesFileName} | Implementation: ${problem.implementationFileName}`;
		case "MissingExportEquals": return `  📝 Missing export equals\n     Types: ${problem.typesFileName} | Implementation: ${problem.implementationFileName}`;
		case "InternalResolutionError": return `  💥 Internal resolution error in ${problem.fileName} (${problem.resolutionOption})\n     Module: ${problem.moduleSpecifier} | Mode: ${problem.resolutionMode}`;
		case "UnexpectedModuleSyntax": return `  📋 Unexpected module syntax in ${problem.fileName}\n     Expected: ${problem.moduleKind} | Found: ${problem.syntax === 99 ? "ESM" : "CJS"}`;
		case "CJSOnlyExportsDefault": return `  🏷️  CJS only exports default in ${problem.fileName}`;
		default: return `  ❓ Unknown problem: ${JSON.stringify(problem)}`;
	}
}
async function attw(options) {
	if (!options.attw) return;
	if (!options.pkg) {
		logger.warn("attw is enabled but package.json is not found");
		return;
	}
	const { profile = "strict", level = "warn",...attwOptions } = options.attw === true ? {} : options.attw;
	const t = performance.now();
	debug$5("Running attw check");
	const tempDir = await mkdtemp(path.join(tmpdir(), "tsdown-attw-"));
	let attwCore;
	try {
		attwCore = await import("@arethetypeswrong/core");
	} catch {
		logger.error(`ATTW check requires ${blue`@arethetypeswrong/core`} to be installed.`);
		return;
	}
	try {
		const { stdout: tarballInfo } = await exec$1(`npm pack --json ----pack-destination ${tempDir}`, {
			encoding: "utf8",
			cwd: options.cwd
		});
		const parsed = JSON.parse(tarballInfo);
		if (!Array.isArray(parsed) || !parsed[0]?.filename) throw new Error("Invalid npm pack output format");
		const tarballPath = path.join(tempDir, parsed[0].filename);
		const tarball = await readFile(tarballPath);
		const pkg = attwCore.createPackageFromTarballData(tarball);
		const checkResult = await attwCore.checkPackage(pkg, attwOptions);
		if (checkResult.types !== false && checkResult.problems) {
			const problems = checkResult.problems.filter((problem) => {
				if ("resolutionKind" in problem) return !profiles[profile]?.includes(problem.resolutionKind);
				return true;
			});
			if (problems.length) {
				const problemList = problems.map(formatProblem).join("\n");
				const problemMessage = `Are the types wrong problems found:\n${problemList}`;
				if (level === "error") throw new Error(problemMessage);
				logger.warn(problemMessage);
			}
		} else logger.success(`No Are the types wrong problems found`, dim`(${Math.round(performance.now() - t)}ms)`);
	} catch (error) {
		logger.error("ATTW check failed:", error);
		debug$5("Found errors, setting exit code to 1");
		process.exitCode = 1;
	} finally {
		await fsRemove(tempDir);
	}
}

//#endregion
//#region src/features/clean.ts
const debug$4 = debug("tsdown:clean");
const RE_LAST_SLASH = /[/\\]$/;
async function cleanOutDir(configs) {
	const removes = /* @__PURE__ */ new Set();
	for (const config of configs) {
		if (!config.clean.length) continue;
		const files = await glob(config.clean, {
			cwd: config.cwd,
			absolute: true,
			onlyFiles: false
		});
		const normalizedOutDir = config.outDir.replace(RE_LAST_SLASH, "");
		for (const file of files) {
			const normalizedFile = file.replace(RE_LAST_SLASH, "");
			if (normalizedFile !== normalizedOutDir) removes.add(file);
		}
	}
	if (!removes.size) return;
	logger.info(`Cleaning ${removes.size} files`);
	await Promise.all([...removes].map(async (file) => {
		debug$4("Removing", file);
		await fsRemove(file);
	}));
	debug$4("Removed %d files", removes.size);
}
function resolveClean(clean, outDir, cwd) {
	if (clean === true) clean = [slash(outDir)];
	else if (!clean) clean = [];
	if (clean.some((item) => path.resolve(item) === cwd)) throw new Error("Cannot clean the current working directory. Please specify a different path to clean option.");
	return clean;
}

//#endregion
//#region src/features/copy.ts
async function copy(options) {
	if (!options.copy) return;
	const copy$1 = typeof options.copy === "function" ? await options.copy(options) : options.copy;
	await Promise.all(toArray(copy$1).map((dir) => {
		const from = typeof dir === "string" ? dir : dir.from;
		const to = typeof dir === "string" ? path.resolve(options.outDir, path.basename(from)) : dir.to;
		return cp$1(options.cwd, from, to);
	}));
}
function cp$1(cwd, from, to) {
	return fsCopy(path.resolve(cwd, from), path.resolve(cwd, to));
}

//#endregion
//#region src/features/exports.ts
async function writeExports(options, chunks) {
	if (!options.exports) return;
	const { outDir, pkg } = options;
	if (!pkg) throw new Error("`package.json` not found, cannot write exports");
	const { publishExports,...generated } = await generateExports(pkg, outDir, chunks, options.exports);
	const updatedPkg = {
		...pkg,
		...generated,
		packageJsonPath: void 0
	};
	if (publishExports) {
		updatedPkg.publishConfig ||= {};
		updatedPkg.publishConfig.exports = publishExports;
	}
	const original = await readFile(pkg.packageJsonPath, "utf8");
	let contents = JSON.stringify(updatedPkg, null, original.includes("	") ? "	" : 2);
	if (original.endsWith("\n")) contents += "\n";
	if (contents !== original) await writeFile(pkg.packageJsonPath, contents, "utf8");
}
async function generateExports(pkg, outDir, chunks, { devExports, all, customExports }) {
	const pkgJsonPath = pkg.packageJsonPath;
	const pkgRoot$1 = path.dirname(pkgJsonPath);
	const outDirRelative = slash(path.relative(pkgRoot$1, outDir));
	let main, module, cjsTypes, esmTypes;
	const exportsMap = /* @__PURE__ */ new Map();
	for (const [format, chunksByFormat] of Object.entries(chunks)) {
		if (format !== "es" && format !== "cjs") continue;
		const onlyOneEntry = chunksByFormat.filter((chunk) => chunk.type === "chunk" && chunk.isEntry && !RE_DTS.test(chunk.fileName)).length === 1;
		for (const chunk of chunksByFormat) {
			if (chunk.type !== "chunk" || !chunk.isEntry) continue;
			const ext = path.extname(chunk.fileName);
			let name = chunk.fileName.slice(0, -ext.length);
			const isDts = name.endsWith(".d");
			if (isDts) name = name.slice(0, -2);
			const isIndex = onlyOneEntry || name === "index";
			const distFile = `${outDirRelative ? `./${outDirRelative}` : "."}/${chunk.fileName}`;
			if (isIndex) {
				name = ".";
				if (format === "cjs") if (isDts) cjsTypes = distFile;
				else main = distFile;
				else if (format === "es") if (isDts) esmTypes = distFile;
				else module = distFile;
			} else name = `./${name}`;
			let subExport = exportsMap.get(name);
			if (!subExport) {
				subExport = {};
				exportsMap.set(name, subExport);
			}
			if (!isDts) {
				subExport[format] = distFile;
				if (chunk.facadeModuleId && !subExport.src) subExport.src = `./${slash(path.relative(pkgRoot$1, chunk.facadeModuleId))}`;
			}
		}
	}
	const sorttedExportsMap = Array.from(exportsMap.entries()).sort(([a], [b]) => {
		if (a === "index") return -1;
		return a.localeCompare(b);
	});
	let exports = Object.fromEntries(sorttedExportsMap.map(([name, subExport]) => [name, genSubExport(devExports, subExport)]));
	exportMeta(exports, all);
	if (customExports) exports = await customExports(exports, {
		pkg,
		outDir,
		chunks,
		isPublish: false
	});
	let publishExports;
	if (devExports) {
		publishExports = Object.fromEntries(sorttedExportsMap.map(([name, subExport]) => [name, genSubExport(false, subExport)]));
		exportMeta(publishExports, all);
		if (customExports) publishExports = await customExports(publishExports, {
			pkg,
			outDir,
			chunks,
			isPublish: true
		});
	}
	return {
		main: main || module || pkg.main,
		module: module || pkg.module,
		types: cjsTypes || esmTypes || pkg.types,
		exports,
		publishExports
	};
}
function genSubExport(devExports, { src, es, cjs }) {
	if (devExports === true) return src;
	let value;
	const dualFormat = es && cjs;
	if (!dualFormat && !devExports) value = cjs || es;
	else {
		value = {};
		if (typeof devExports === "string") value[devExports] = src;
		if (es) value[dualFormat ? "import" : "default"] = es;
		if (cjs) value[dualFormat ? "require" : "default"] = cjs;
	}
	return value;
}
function exportMeta(exports, all) {
	if (all) exports["./*"] = "./*";
	else exports["./package.json"] = "./package.json";
}

//#endregion
//#region src/features/hooks.ts
async function createHooks$1(options) {
	const hooks = createHooks();
	if (typeof options.hooks === "object") hooks.addHooks(options.hooks);
	else if (typeof options.hooks === "function") await options.hooks(hooks);
	const context = {
		options,
		hooks
	};
	return {
		hooks,
		context
	};
}

//#endregion
//#region src/utils/lightningcss.ts
/**
* Converts esbuild target [^1] (which is also used by Rolldown [^2]) to Lightning CSS targets [^3].
*
* [^1]: https://esbuild.github.io/api/#target
* [^2]: https://github.com/rolldown/rolldown/blob/v1.0.0-beta.8/packages/rolldown/src/binding.d.ts#L1429-L1431
* [^3]: https://lightningcss.dev/transpilation.html
*/
function esbuildTargetToLightningCSS(target) {
	let targets;
	const targetString = target.join(" ").toLowerCase();
	const matches = [...targetString.matchAll(TARGET_REGEX)];
	for (const match of matches) {
		const name = match[1];
		const browser = ESBUILD_LIGHTNINGCSS_MAPPING[name];
		if (!browser) continue;
		const version = match[2];
		const versionInt = parseVersion(version);
		if (versionInt == null) continue;
		targets = targets || {};
		targets[browser] = versionInt;
	}
	return targets;
}
const TARGET_REGEX = /([a-z]+)(\d+(?:\.\d+)*)/g;
const ESBUILD_LIGHTNINGCSS_MAPPING = {
	chrome: "chrome",
	edge: "edge",
	firefox: "firefox",
	ie: "ie",
	ios: "ios_saf",
	opera: "opera",
	safari: "safari"
};
function parseVersion(version) {
	const [major, minor = 0, patch = 0] = version.split("-")[0].split(".").map((v) => Number.parseInt(v, 10));
	if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) return null;
	return major << 16 | minor << 8 | patch;
}

//#endregion
//#region src/features/lightningcss.ts
async function LightningCSSPlugin(options) {
	const LightningCSS = await import("unplugin-lightningcss/rolldown").catch(() => void 0);
	if (!LightningCSS) return;
	const targets = options.target && esbuildTargetToLightningCSS(options.target);
	if (!targets) return;
	return LightningCSS.default({ options: { targets } });
}

//#endregion
//#region src/utils/package.ts
const debug$3 = debug("tsdown:package");
async function readPackageJson(dir) {
	const packageJsonPath = up({ cwd: dir });
	if (!packageJsonPath) return;
	debug$3("Reading package.json:", packageJsonPath);
	const contents = await readFile(packageJsonPath, "utf8");
	return {
		...JSON.parse(contents),
		packageJsonPath
	};
}
function getPackageType(pkg) {
	if (pkg?.type) {
		if (!["module", "commonjs"].includes(pkg.type)) throw new Error(`Invalid package.json type: ${pkg.type}`);
		return pkg.type;
	}
}
function normalizeFormat(format) {
	return resolveComma(toArray(format, "es")).map((format$1) => {
		switch (format$1) {
			case "es":
			case "esm":
			case "module": return "es";
			case "cjs":
			case "commonjs": return "cjs";
			default: return format$1;
		}
	});
}

//#endregion
//#region src/features/output.ts
function resolveJsOutputExtension(packageType, format, fixedExtension) {
	switch (format) {
		case "es": return !fixedExtension && packageType === "module" ? "js" : "mjs";
		case "cjs": return fixedExtension || packageType === "module" ? "cjs" : "js";
		default: return "js";
	}
}
function resolveChunkFilename({ outExtensions, fixedExtension, pkg, hash }, inputOptions, format) {
	const packageType = getPackageType(pkg);
	let jsExtension;
	let dtsExtension;
	if (outExtensions) {
		const { js, dts } = outExtensions({
			options: inputOptions,
			format,
			pkgType: packageType
		}) || {};
		jsExtension = js;
		dtsExtension = dts;
	}
	jsExtension ||= `.${resolveJsOutputExtension(packageType, format, fixedExtension)}`;
	const suffix = format === "iife" || format === "umd" ? `.${format}` : "";
	return [createChunkFilename(`[name]${suffix}`, jsExtension, dtsExtension), createChunkFilename(`[name]${suffix}${hash ? "-[hash]" : ""}`, jsExtension, dtsExtension)];
}
function createChunkFilename(basename, jsExtension, dtsExtension) {
	if (!dtsExtension) return `${basename}${jsExtension}`;
	return (chunk) => {
		return `${basename}${chunk.name.endsWith(".d") ? dtsExtension : jsExtension}`;
	};
}

//#endregion
//#region src/features/publint.ts
const debug$2 = debug("tsdown:publint");
async function publint(options) {
	if (!options.publint) return;
	if (!options.pkg) {
		logger.warn("publint is enabled but package.json is not found");
		return;
	}
	const t = performance.now();
	debug$2("Running publint");
	const { publint: publint$1 } = await import("publint");
	const { formatMessage } = await import("publint/utils");
	const { messages } = await publint$1(options.publint === true ? {} : options.publint);
	debug$2("Found %d issues", messages.length);
	if (!messages.length) logger.success(`No publint issues found`, dim`(${Math.round(performance.now() - t)}ms)`);
	let hasError = false;
	for (const message of messages) {
		hasError ||= message.type === "error";
		const formattedMessage = formatMessage(message, options.pkg);
		const logType = {
			error: "error",
			warning: "warn",
			suggestion: "info"
		}[message.type];
		logger[logType](formattedMessage);
	}
	if (hasError) {
		debug$2("Found errors, setting exit code to 1");
		process.exitCode = 1;
	}
}

//#endregion
//#region src/features/shims.ts
function getShimsInject(format, platform) {
	if (format === "es" && platform === "node") {
		const shimFile = path.resolve(pkgRoot, "esm-shims.js");
		return {
			__dirname: [shimFile, "__dirname"],
			__filename: [shimFile, "__filename"]
		};
	}
}

//#endregion
//#region src/features/shortcuts.ts
function shortcuts(restart) {
	let actionRunning = false;
	async function onInput(input) {
		if (actionRunning) return;
		const SHORTCUTS = [
			{
				key: "r",
				description: "reload config and rebuild",
				action() {
					rl.close();
					restart();
				}
			},
			{
				key: "c",
				description: "clear console",
				action() {
					console.clear();
				}
			},
			{
				key: "q",
				description: "quit",
				action() {
					process.exit(0);
				}
			}
		];
		if (input === "h") {
			const loggedKeys = /* @__PURE__ */ new Set();
			logger.info("  Shortcuts");
			for (const shortcut$1 of SHORTCUTS) {
				if (loggedKeys.has(shortcut$1.key)) continue;
				loggedKeys.add(shortcut$1.key);
				if (shortcut$1.action == null) continue;
				logger.info(dim`  press ` + bold`${shortcut$1.key} + enter` + dim` to ${shortcut$1.description}`);
			}
			return;
		}
		const shortcut = SHORTCUTS.find((shortcut$1) => shortcut$1.key === input);
		if (!shortcut) return;
		actionRunning = true;
		await shortcut.action();
		actionRunning = false;
	}
	const rl = readline.createInterface({ input: process.stdin });
	rl.on("line", onInput);
}

//#endregion
//#region src/features/target.ts
function resolveTarget(target, pkg, name) {
	if (target === false) return;
	if (target == null) {
		const pkgTarget = resolvePackageTarget(pkg);
		if (pkgTarget) target = pkgTarget;
		else return;
	}
	const targets = resolveComma(toArray(target));
	if (targets.length) logger.info(prettyName(name), `target${targets.length > 1 ? "s" : ""}: ${generateColor(name)(targets.join(", "))}`);
	return targets;
}
function resolvePackageTarget(pkg) {
	const nodeVersion = pkg?.engines?.node;
	if (!nodeVersion) return;
	const nodeMinVersion = minVersion(nodeVersion);
	if (!nodeMinVersion) return;
	if (nodeMinVersion.version === "0.0.0") return;
	return `node${nodeMinVersion.version}`;
}
let warned = false;
function RuntimeHelperCheckPlugin(targets) {
	return {
		name: "tsdown:runtime-helper-check",
		resolveId: {
			filter: { id: /^@oxc-project\/runtime/ },
			async handler(id, ...args) {
				const EXTERNAL = {
					id,
					external: true
				};
				if (warned) return EXTERNAL;
				const resolved = await this.resolve(id, ...args);
				if (!resolved) {
					if (!warned) {
						warned = true;
						logger.warn(`The target environment (${targets.join(", ")}) requires runtime helpers from ${blue`@oxc-project/runtime`}. Please install it to ensure all necessary polyfills are included.\nFor more information, visit: https://tsdown.dev/options/target#runtime-helpers`);
					}
					return EXTERNAL;
				}
				return resolved;
			}
		}
	};
}

//#endregion
//#region src/features/watch.ts
const endsWithConfig = /[\\/](?:package\.json|tsdown\.config.*)$/;
async function watchBuild(options, configFiles, rebuild, restart) {
	if (typeof options.watch === "boolean" && options.outDir === options.cwd) throw new Error(`Watch is enabled, but output directory is the same as the current working directory.Please specify a different watch directory using ${blue`watch`} option,or set ${blue`outDir`} to a different directory.`);
	const files = toArray(typeof options.watch === "boolean" ? options.cwd : options.watch);
	logger.info(`Watching for changes in ${files.join(", ")}`);
	files.push(...configFiles);
	const { watch } = await import("chokidar");
	const debouncedRebuild = debounce(rebuild, 100);
	const watcher = watch(files, {
		ignoreInitial: true,
		ignorePermissionErrors: true,
		ignored: [
			/[\\/]\.git[\\/]/,
			/[\\/]node_modules[\\/]/,
			options.outDir,
			...toArray(options.ignoreWatch)
		]
	});
	watcher.on("all", (type, file) => {
		if (configFiles.includes(file) || endsWithConfig.test(file)) {
			logger.info(`Reload config: ${file}`);
			restart();
			return;
		}
		logger.info(`Change detected: ${type} ${file}`);
		debouncedRebuild();
	});
	return watcher;
}

//#endregion
//#region src/features/entry.ts
async function resolveEntry(entry, cwd, name) {
	const nameLabel = name ? `[${name}] ` : "";
	if (!entry || Object.keys(entry).length === 0) {
		const defaultEntry = path.resolve(cwd, "src/index.ts");
		if (await fsExists(defaultEntry)) entry = { index: defaultEntry };
		else throw new Error(`${nameLabel}No input files, try "tsdown <your-file>" or create src/index.ts`);
	}
	const entryMap = await toObjectEntry(entry, cwd);
	const entries = Object.values(entryMap);
	if (entries.length === 0) throw new Error(`${nameLabel}Cannot find entry: ${JSON.stringify(entry)}`);
	logger.info(prettyName(name), `entry: ${generateColor(name)(entries.map((entry$1) => path.relative(cwd, entry$1)).join(", "))}`);
	return entryMap;
}
async function toObjectEntry(entry, cwd) {
	if (typeof entry === "string") entry = [entry];
	if (!Array.isArray(entry)) return entry;
	const resolvedEntry = (await glob(entry, { cwd })).map((file) => path.resolve(cwd, file));
	const base = lowestCommonAncestor(...resolvedEntry);
	return Object.fromEntries(resolvedEntry.map((file) => {
		const relative = path.relative(base, file);
		return [relative.slice(0, relative.length - path.extname(relative).length), file];
	}));
}

//#endregion
//#region src/features/tsconfig.ts
function findTsconfig(cwd, name = "tsconfig.json") {
	return up$1(name, { cwd }) || false;
}
async function resolveTsconfig(tsconfig, cwd, name) {
	const original = tsconfig;
	if (tsconfig !== false) {
		if (tsconfig === true || tsconfig == null) {
			tsconfig = findTsconfig(cwd);
			if (original && !tsconfig) logger.warn(`No tsconfig found in ${blue(cwd)}`);
		} else {
			const tsconfigPath = path.resolve(cwd, tsconfig);
			const stat$1 = await fsStat(tsconfigPath);
			if (stat$1?.isFile()) tsconfig = tsconfigPath;
			else if (stat$1?.isDirectory()) {
				tsconfig = findTsconfig(tsconfigPath);
				if (!tsconfig) logger.warn(`No tsconfig found in ${blue(tsconfigPath)}`);
			} else {
				tsconfig = findTsconfig(cwd, tsconfig);
				if (!tsconfig) logger.warn(`tsconfig ${blue(original)} doesn't exist`);
			}
		}
		if (tsconfig) logger.info(prettyName(name), `tsconfig: ${generateColor(name)(path.relative(cwd, tsconfig))}`);
	}
	return tsconfig;
}

//#endregion
//#region src/options/config.ts
async function loadViteConfig(prefix, cwd) {
	const { config, sources: [source] } = await loadConfig({
		sources: [{
			files: `${prefix}.config`,
			extensions: [
				"ts",
				"mts",
				"cts",
				"js",
				"mjs",
				"cjs",
				"json",
				""
			]
		}],
		cwd,
		defaults: {}
	});
	if (!source) return;
	logger.info(`Using Vite config: ${underline(source)}`);
	const resolved = await config;
	if (typeof resolved === "function") return resolved({
		command: "build",
		mode: "production"
	});
	return resolved;
}
let loaded = false;
async function loadConfigFile(options, workspace) {
	let cwd = options.cwd || process.cwd();
	let overrideConfig = false;
	let { config: filePath } = options;
	if (filePath === false) return { configs: [{}] };
	if (typeof filePath === "string") {
		const stats = await fsStat(filePath);
		if (stats) {
			const resolved = path.resolve(filePath);
			if (stats.isFile()) {
				overrideConfig = true;
				filePath = resolved;
				cwd = path.dirname(filePath);
			} else if (stats.isDirectory()) cwd = resolved;
		}
	}
	const nativeTS = process.features.typescript || process.versions.bun || process.versions.deno;
	let { config, sources } = await loadConfig.async({
		sources: overrideConfig ? [{
			files: filePath,
			extensions: []
		}] : [{
			files: "tsdown.config",
			extensions: [
				"ts",
				"mts",
				"cts",
				"js",
				"mjs",
				"cjs",
				"json",
				""
			],
			parser: loaded || !nativeTS ? "auto" : async (filepath) => {
				const mod = await import(pathToFileURL(filepath).href);
				const config$1 = mod.default || mod;
				return config$1;
			}
		}, {
			files: "package.json",
			extensions: [],
			rewrite: (config$1) => config$1?.tsdown
		}],
		cwd,
		stopAt: workspace && path.dirname(workspace),
		defaults: {}
	}).finally(() => loaded = true);
	const file = sources[0];
	if (file) logger.info(`Using tsdown config: ${underline(file)}`);
	if (typeof config === "function") config = await config(options);
	config = toArray(config);
	if (config.length === 0) config.push({});
	return {
		configs: config,
		file
	};
}

//#endregion
//#region src/options/index.ts
const debug$1 = debug("tsdown:options");
const DEFAULT_EXCLUDE_WORKSPACE = [
	"**/node_modules/**",
	"**/dist/**",
	"**/test?(s)/**",
	"**/t?(e)mp/**"
];
async function resolveOptions(options) {
	const files = [];
	debug$1("options %O", options);
	debug$1("loading config file: %s", options.config);
	const { configs: rootConfigs, file } = await loadConfigFile(options);
	if (file) {
		files.push(file);
		debug$1("loaded root config file %s", file);
		debug$1("root configs %o", rootConfigs);
	} else debug$1("no root config file found");
	const configs = (await Promise.all(rootConfigs.map(async (rootConfig) => {
		const { configs: workspaceConfigs, files: workspaceFiles } = await resolveWorkspace(rootConfig, options);
		if (workspaceFiles) files.push(...workspaceFiles);
		return Promise.all(workspaceConfigs.filter((config) => !config.workspace || config.entry).map((config) => resolveConfig(config)));
	}))).flat();
	debug$1("resolved configs %O", configs);
	return {
		configs,
		files
	};
}
async function resolveWorkspace(config, options) {
	const normalized = {
		...config,
		...options
	};
	const rootCwd = normalized.cwd || process.cwd();
	let { workspace } = normalized;
	if (!workspace) return {
		configs: [normalized],
		files: []
	};
	if (workspace === true) workspace = {};
	else if (typeof workspace === "string" || Array.isArray(workspace)) workspace = { include: workspace };
	let { include: packages = "auto", exclude = DEFAULT_EXCLUDE_WORKSPACE, config: workspaceConfig } = workspace;
	if (packages === "auto") packages = (await glob({
		patterns: "**/package.json",
		ignore: exclude,
		cwd: rootCwd
	})).filter((file) => file !== "package.json").map((file) => path.resolve(rootCwd, file, ".."));
	else packages = (await glob({
		patterns: packages,
		ignore: exclude,
		cwd: rootCwd,
		onlyDirectories: true,
		absolute: true
	})).map((file) => path.resolve(file));
	if (packages.length === 0) throw new Error("No workspace packages found, please check your config");
	if (options.filter) {
		if (typeof options.filter === "string" && options.filter.length > 2 && options.filter[0] === "/" && options.filter.at(-1) === "/") options.filter = new RegExp(options.filter.slice(1, -1));
		packages = packages.filter((path$1) => {
			return typeof options.filter === "string" ? path$1.includes(options.filter) : Array.isArray(options.filter) ? options.filter.some((filter) => path$1.includes(filter)) : options.filter.test(path$1);
		});
		if (packages.length === 0) throw new Error("No packages matched the filters");
	}
	const files = [];
	const configs = (await Promise.all(packages.map(async (cwd) => {
		debug$1("loading workspace config %s", cwd);
		const { configs: configs$1, file } = await loadConfigFile({
			...options,
			config: workspaceConfig,
			cwd
		}, cwd);
		if (file) {
			debug$1("loaded workspace config file %s", file);
			files.push(file);
		} else debug$1("no workspace config file found in %s", cwd);
		return configs$1.map((config$1) => ({
			...normalized,
			cwd,
			...config$1
		}));
	}))).flat();
	return {
		configs,
		files
	};
}
async function resolveConfig(userConfig) {
	let { entry, format = ["es"], plugins = [], clean = true, silent = false, treeshake = true, platform = "node", outDir = "dist", sourcemap = false, dts, unused = false, watch = false, ignoreWatch = [], shims = false, skipNodeModulesBundle = false, publint: publint$1 = false, attw: attw$1 = false, fromVite, alias, tsconfig, report = true, target, env = {}, copy: copy$1, publicDir, hash, cwd = process.cwd(), name, workspace, external, noExternal, exports = false, bundle, unbundle = typeof bundle === "boolean" ? !bundle : false, removeNodeProtocol, nodeProtocol } = userConfig;
	if (typeof bundle === "boolean") logger.warn("`bundle` option is deprecated. Use `unbundle` instead.");
	nodeProtocol = nodeProtocol ?? (removeNodeProtocol ? "strip" : false);
	outDir = path.resolve(cwd, outDir);
	clean = resolveClean(clean, outDir, cwd);
	const pkg = await readPackageJson(cwd);
	if (workspace) name ||= pkg?.name;
	entry = await resolveEntry(entry, cwd, name);
	if (dts == null) dts = !!(pkg?.types || pkg?.typings);
	target = resolveTarget(target, pkg, name);
	tsconfig = await resolveTsconfig(tsconfig, cwd, name);
	if (typeof external === "string") external = resolveRegex(external);
	if (typeof noExternal === "string") noExternal = resolveRegex(noExternal);
	if (publint$1 === true) publint$1 = {};
	if (attw$1 === true) attw$1 = {};
	if (exports === true) exports = {};
	if (publicDir) if (copy$1) throw new TypeError("`publicDir` is deprecated. Cannot be used with `copy`");
	else logger.warn(`${blue`publicDir`} is deprecated. Use ${blue`copy`} instead.`);
	if (fromVite) {
		const viteUserConfig = await loadViteConfig(fromVite === true ? "vite" : fromVite, cwd);
		if (viteUserConfig) {
			if (Array.isArray(alias)) throw new TypeError("Unsupported resolve.alias in Vite config. Use object instead of array");
			if (viteUserConfig.plugins) plugins = [viteUserConfig.plugins, plugins];
			const viteAlias = viteUserConfig.resolve?.alias;
			if (viteAlias && !Array.isArray(viteAlias)) alias = viteAlias;
		}
	}
	const config = {
		...userConfig,
		entry,
		plugins,
		format: normalizeFormat(format),
		target,
		outDir,
		clean,
		silent,
		treeshake,
		platform,
		sourcemap,
		dts: dts === true ? {} : dts,
		report: report === true ? {} : report,
		unused,
		watch,
		ignoreWatch,
		shims,
		skipNodeModulesBundle,
		publint: publint$1,
		attw: attw$1,
		alias,
		tsconfig,
		cwd,
		env,
		pkg,
		copy: publicDir || copy$1,
		hash: hash ?? true,
		name,
		external,
		noExternal,
		exports,
		unbundle,
		nodeProtocol
	};
	return config;
}
async function mergeUserOptions(defaults, user, args) {
	const userOutputOptions = typeof user === "function" ? await user(defaults, ...args) : user;
	return {
		...defaults,
		...userOutputOptions
	};
}

//#endregion
//#region src/index.ts
/**
* Build with tsdown.
*/
async function build(userOptions = {}) {
	if (typeof userOptions.silent === "boolean") logger.setSilent(userOptions.silent);
	const { configs, files: configFiles } = await resolveOptions(userOptions);
	let cleanPromise;
	const clean = () => {
		if (cleanPromise) return cleanPromise;
		return cleanPromise = cleanOutDir(configs);
	};
	logger.info("Build start");
	const rebuilds = await Promise.all(configs.map((options) => buildSingle(options, clean)));
	const cleanCbs = [];
	for (const [i, config] of configs.entries()) {
		const rebuild = rebuilds[i];
		if (!rebuild) continue;
		const watcher = await watchBuild(config, configFiles, rebuild, restart);
		cleanCbs.push(() => watcher.close());
	}
	if (cleanCbs.length) shortcuts(restart);
	async function restart() {
		for (const clean$1 of cleanCbs) await clean$1();
		build(userOptions);
	}
}
const dirname$1 = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(dirname$1, "..");
/**
* Build a single configuration, without watch and shortcuts features.
*
* Internal API, not for public use
*
* @private
* @param config Resolved options
*/
async function buildSingle(config, clean) {
	const { format: formats, dts, watch, onSuccess } = config;
	let ab;
	const { hooks, context } = await createHooks$1(config);
	await rebuild(true);
	if (watch) return () => rebuild();
	async function rebuild(first) {
		const startTime = performance.now();
		await hooks.callHook("build:prepare", context);
		ab?.abort();
		await clean();
		let hasErrors = false;
		const isMultiFormat = formats.length > 1;
		const chunks = {};
		await Promise.all(formats.map(async (format) => {
			try {
				const buildOptions = await getBuildOptions(config, format, isMultiFormat, false);
				await hooks.callHook("build:before", {
					...context,
					buildOptions
				});
				const { output } = await build$1(buildOptions);
				chunks[format] = output;
				if (format === "cjs" && dts) {
					const { output: output$1 } = await build$1(await getBuildOptions(config, format, isMultiFormat, true));
					chunks[format].push(...output$1);
				}
			} catch (error) {
				if (watch) {
					logger.error(error);
					hasErrors = true;
					return;
				}
				throw error;
			}
		}));
		if (hasErrors) return;
		await Promise.all([writeExports(config, chunks), copy(config)]);
		await Promise.all([publint(config), attw(config)]);
		await hooks.callHook("build:done", context);
		logger.success(prettyName(config.name), `${first ? "Build" : "Rebuild"} complete in ${green(`${Math.round(performance.now() - startTime)}ms`)}`);
		ab = new AbortController();
		if (typeof onSuccess === "string") {
			const p = exec(onSuccess, [], { nodeOptions: {
				shell: true,
				stdio: "inherit",
				signal: ab.signal
			} });
			p.then(({ exitCode }) => {
				if (exitCode) process.exitCode = exitCode;
			});
		} else await onSuccess?.(config, ab.signal);
	}
}
async function getBuildOptions(config, format, isMultiFormat, cjsDts) {
	const { entry, external, plugins: userPlugins, outDir, platform, alias, treeshake, sourcemap, dts, minify, unused, target, define, shims, tsconfig, cwd, report, env, nodeProtocol, loader, name, unbundle } = config;
	const plugins = [];
	if (nodeProtocol) plugins.push(NodeProtocolPlugin(nodeProtocol));
	if (config.pkg || config.skipNodeModulesBundle) plugins.push(ExternalPlugin(config));
	if (dts) {
		const { dts: dtsPlugin } = await import("rolldown-plugin-dts");
		const options = {
			tsconfig,
			...dts
		};
		if (format === "es") plugins.push(dtsPlugin(options));
		else if (cjsDts) plugins.push(dtsPlugin({
			...options,
			emitDtsOnly: true
		}));
	}
	if (!cjsDts) {
		if (unused) {
			const { Unused } = await import("unplugin-unused");
			plugins.push(Unused.rolldown(unused === true ? {} : unused));
		}
		if (target) plugins.push(RuntimeHelperCheckPlugin(target), await LightningCSSPlugin({ target }));
		plugins.push(ShebangPlugin(cwd, name, isMultiFormat));
	}
	if (report && !logger.silent) plugins.push(ReportPlugin(report, cwd, cjsDts, name, isMultiFormat));
	if (!cjsDts) plugins.push(userPlugins);
	const inputOptions = await mergeUserOptions({
		input: entry,
		cwd,
		external,
		resolve: {
			alias,
			tsconfigFilename: tsconfig || void 0
		},
		treeshake,
		platform: cjsDts || format === "cjs" ? "node" : platform,
		define: {
			...define,
			...Object.keys(env).reduce((acc, key) => {
				const value = JSON.stringify(env[key]);
				acc[`process.env.${key}`] = value;
				acc[`import.meta.env.${key}`] = value;
				return acc;
			}, Object.create(null))
		},
		transform: { target },
		plugins,
		inject: { ...shims && !cjsDts && getShimsInject(format, platform) },
		moduleTypes: loader
	}, config.inputOptions, [format]);
	const [entryFileNames, chunkFileNames] = resolveChunkFilename(config, inputOptions, format);
	const outputOptions = await mergeUserOptions({
		format: cjsDts ? "es" : format,
		name: config.globalName,
		sourcemap,
		dir: outDir,
		minify: !cjsDts && minify,
		entryFileNames,
		chunkFileNames,
		preserveModules: unbundle,
		preserveModulesRoot: unbundle ? lowestCommonAncestor(...Object.values(entry)) : void 0
	}, config.outputOptions, [format]);
	return {
		...inputOptions,
		output: outputOptions
	};
}

//#endregion
export { build, buildSingle, defineConfig, logger, pkgRoot };