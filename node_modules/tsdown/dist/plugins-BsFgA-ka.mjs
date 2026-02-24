import { logger, noop, prettyFormat, prettyName, toArray } from "./logger-CdK2zFTY.mjs";
import { builtinModules } from "node:module";
import path, { dirname, normalize, sep } from "node:path";
import { bold, dim, green, underline } from "ansis";
import { access, chmod, cp, rm, stat } from "node:fs/promises";
import { promisify } from "node:util";
import debug from "debug";
import { RE_DTS } from "rolldown-plugin-dts/filename";
import { Buffer } from "node:buffer";
import { brotliCompress, gzip } from "node:zlib";

//#region src/utils/fs.ts
function fsExists(path$1) {
	return access(path$1).then(() => true, () => false);
}
function fsStat(path$1) {
	return stat(path$1).catch(() => null);
}
function fsRemove(path$1) {
	return rm(path$1, {
		force: true,
		recursive: true
	}).catch(() => {});
}
function fsCopy(from, to) {
	return cp(from, to, {
		recursive: true,
		force: true
	});
}
function lowestCommonAncestor(...filepaths) {
	if (filepaths.length === 0) return "";
	if (filepaths.length === 1) return dirname(filepaths[0]);
	filepaths = filepaths.map(normalize);
	const [first, ...rest] = filepaths;
	let ancestor = first.split(sep);
	for (const filepath of rest) {
		const directories = filepath.split(sep, ancestor.length);
		let index = 0;
		for (const directory of directories) if (directory === ancestor[index]) index += 1;
		else {
			ancestor = ancestor.slice(0, index);
			break;
		}
		ancestor = ancestor.slice(0, index);
	}
	return ancestor.length <= 1 && ancestor[0] === "" ? sep + ancestor[0] : ancestor.join(sep);
}

//#endregion
//#region src/features/external.ts
const debug$2 = debug("tsdown:external");
function ExternalPlugin(options) {
	const deps = options.pkg && Array.from(getProductionDeps(options.pkg));
	return {
		name: "tsdown:external",
		async resolveId(id, importer, extraOptions) {
			if (extraOptions.isEntry) return;
			const { noExternal } = options;
			if (typeof noExternal === "function" && noExternal(id, importer)) return;
			if (noExternal) {
				const noExternalPatterns = toArray(noExternal);
				if (noExternalPatterns.some((pattern) => {
					if (pattern instanceof RegExp) {
						pattern.lastIndex = 0;
						return pattern.test(id);
					}
					return id === pattern;
				})) return;
			}
			let shouldExternal = false;
			if (options.skipNodeModulesBundle) {
				const resolved = await this.resolve(id, importer, extraOptions);
				if (!resolved) return resolved;
				shouldExternal = resolved.external || /[\\/]node_modules[\\/]/.test(resolved.id);
			}
			if (deps) shouldExternal ||= deps.some((dep) => id === dep || id.startsWith(`${dep}/`));
			if (shouldExternal) {
				debug$2("External dependency:", id);
				return {
					id,
					external: shouldExternal,
					moduleSideEffects: id.startsWith("node:") || builtinModules.includes(id) ? false : void 0
				};
			}
		}
	};
}
function getProductionDeps(pkg) {
	return new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.peerDependencies || {})]);
}

//#endregion
//#region src/features/node-protocol.ts
/**
* The `node:` protocol was added in Node.js v14.18.0.
* @see https://nodejs.org/api/esm.html#node-imports
*/
function NodeProtocolPlugin(nodeProtocolOption) {
	if (nodeProtocolOption === "strip") return {
		name: "tsdown:node-protocol:strip",
		resolveId: {
			order: "pre",
			filter: { id: /^node:/ },
			handler(id) {
				return {
					id: id.slice(5),
					external: true,
					moduleSideEffects: false
				};
			}
		}
	};
	const builtinModulesRegex = /* @__PURE__ */ new RegExp(`^(${builtinModules.join("|")})$`);
	return {
		name: "tsdown:node-protocol:add",
		resolveId: {
			order: "pre",
			filter: { id: builtinModulesRegex },
			handler(id) {
				return {
					id: `node:${id}`,
					external: true,
					moduleSideEffects: false
				};
			}
		}
	};
}

//#endregion
//#region src/utils/format.ts
function formatBytes(bytes) {
	if (bytes === Infinity) return void 0;
	return `${(bytes / 1e3).toFixed(2)} kB`;
}

//#endregion
//#region src/features/report.ts
const debug$1 = debug("tsdown:report");
const brotliCompressAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);
function ReportPlugin(options, cwd, cjsDts, name, isMultiFormat) {
	return {
		name: "tsdown:report",
		async writeBundle(outputOptions, bundle) {
			const outDir = path.relative(cwd, outputOptions.file ? path.resolve(cwd, outputOptions.file, "..") : path.resolve(cwd, outputOptions.dir));
			const sizes = [];
			for (const chunk of Object.values(bundle)) {
				const size = await calcSize(options, chunk);
				sizes.push(size);
			}
			const filenameLength = Math.max(...sizes.map((size) => size.filename.length));
			const rawTextLength = Math.max(...sizes.map((size) => size.rawText.length));
			const gzipTextLength = Math.max(...sizes.map((size) => size.gzipText == null ? 0 : size.gzipText.length));
			const brotliTextLength = Math.max(...sizes.map((size) => size.brotliText == null ? 0 : size.brotliText.length));
			let totalRaw = 0;
			for (const size of sizes) {
				size.rawText = size.rawText.padStart(rawTextLength);
				size.gzipText = size.gzipText?.padStart(gzipTextLength);
				size.brotliText = size.brotliText?.padStart(brotliTextLength);
				totalRaw += size.raw;
			}
			sizes.sort((a, b) => {
				if (a.dts !== b.dts) return a.dts ? 1 : -1;
				if (a.isEntry !== b.isEntry) return a.isEntry ? -1 : 1;
				return b.raw - a.raw;
			});
			const nameLabel = prettyName(name);
			const formatLabel = isMultiFormat && prettyFormat(cjsDts ? "cjs" : outputOptions.format);
			for (const size of sizes) {
				const filenameColor = size.dts ? green : noop;
				logger.info(nameLabel, formatLabel, dim(`${outDir}/`) + filenameColor((size.isEntry ? bold : noop)(size.filename)), ` `.repeat(filenameLength - size.filename.length), dim(size.rawText), size.gzipText && dim`│ gzip: ${size.gzipText}`, options.brotli && size.brotliText && dim`│ brotli: ${size.brotliText}`);
			}
			const totalSizeText = formatBytes(totalRaw);
			logger.info(nameLabel, formatLabel, `${sizes.length} files, total: ${totalSizeText}`);
		}
	};
}
async function calcSize(options, chunk) {
	debug$1(`Calculating size for`, chunk.fileName);
	const content = chunk.type === "chunk" ? chunk.code : chunk.source;
	const raw = Buffer.byteLength(content, "utf8");
	debug$1("[size]", chunk.fileName, raw);
	let gzip$1 = Infinity;
	let brotli = Infinity;
	if (raw > (options.maxCompressSize ?? 1e6)) debug$1(chunk.fileName, "file size exceeds limit, skip gzip/brotli");
	else {
		gzip$1 = (await gzipAsync(content)).length;
		debug$1("[gzip]", chunk.fileName, gzip$1);
		if (options.brotli) {
			brotli = (await brotliCompressAsync(content)).length;
			debug$1("[brotli]", chunk.fileName, brotli);
		}
	}
	return {
		filename: chunk.fileName,
		dts: RE_DTS.test(chunk.fileName),
		isEntry: chunk.type === "chunk" && chunk.isEntry,
		raw,
		rawText: formatBytes(raw),
		gzip: gzip$1,
		gzipText: formatBytes(gzip$1),
		brotli,
		brotliText: formatBytes(brotli)
	};
}

//#endregion
//#region src/features/shebang.ts
const RE_SHEBANG = /^#!.*/;
function ShebangPlugin(cwd, name, isMultiFormat) {
	return {
		name: "tsdown:shebang",
		async writeBundle(options, bundle) {
			for (const chunk of Object.values(bundle)) {
				if (chunk.type !== "chunk" || !chunk.isEntry) continue;
				if (!RE_SHEBANG.test(chunk.code)) continue;
				const filepath = path.resolve(cwd, options.file || path.join(options.dir, chunk.fileName));
				if (await fsExists(filepath)) {
					logger.info(prettyName(name), isMultiFormat && prettyFormat(options.format), `Granting execute permission to ${underline(path.relative(cwd, filepath))}`);
					await chmod(filepath, 493);
				}
			}
		}
	};
}

//#endregion
export { ExternalPlugin, NodeProtocolPlugin, ReportPlugin, ShebangPlugin, fsCopy, fsExists, fsRemove, fsStat, lowestCommonAncestor };