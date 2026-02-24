import { createRequire } from "node:module";
import path from "node:path";
import Debug from "debug";
import ts from "typescript";

//#region src/tsc/system.ts
const debug$2 = Debug("rolldown-plugin-dts:tsc-system");
/**
* A system that writes files to both memory and disk. It will try read files
* from memory firstly and fallback to disk if not found.
*/
function createFsSystem(files) {
	return {
		...ts.sys,
		write(message) {
			debug$2(message);
		},
		resolvePath(path$1) {
			if (files.has(path$1)) return path$1;
			return ts.sys.resolvePath(path$1);
		},
		directoryExists(directory) {
			if (Array.from(files.keys()).some((path$1) => path$1.startsWith(directory))) return true;
			return ts.sys.directoryExists(directory);
		},
		fileExists(fileName) {
			if (files.has(fileName)) return true;
			return ts.sys.fileExists(fileName);
		},
		readFile(fileName, ...args) {
			if (files.has(fileName)) return files.get(fileName);
			return ts.sys.readFile(fileName, ...args);
		},
		writeFile(path$1, data, ...args) {
			files.set(path$1, data);
			ts.sys.writeFile(path$1, data, ...args);
		},
		deleteFile(fileName, ...args) {
			files.delete(fileName);
			ts.sys.deleteFile?.(fileName, ...args);
		}
	};
}
function createMemorySystem(files) {
	return {
		...createFsSystem(files),
		writeFile(path$1, data) {
			files.set(path$1, data);
		},
		deleteFile(fileName) {
			files.delete(fileName);
		}
	};
}

//#endregion
//#region src/tsc/vue.ts
const debug$1 = Debug("rolldown-plugin-dts:vue");
let createVueProgram;
const require = createRequire(import.meta.url);
function loadVueLanguageTools() {
	try {
		const vueTscPath = require.resolve("vue-tsc");
		const { proxyCreateProgram } = require(require.resolve("@volar/typescript", { paths: [vueTscPath] }));
		const vue = require(require.resolve("@vue/language-core", { paths: [vueTscPath] }));
		return {
			proxyCreateProgram,
			vue
		};
	} catch (error) {
		debug$1("vue language tools not found", error);
		throw new Error("Failed to load vue language tools. Please manually install vue-tsc.");
	}
}
function createVueProgramFactory(ts$1) {
	if (createVueProgram) return createVueProgram;
	debug$1("loading vue language tools");
	const { proxyCreateProgram, vue } = loadVueLanguageTools();
	return createVueProgram = proxyCreateProgram(ts$1, ts$1.createProgram, (ts$2, options) => {
		const $rootDir = options.options.$rootDir;
		const $configRaw = options.options.$configRaw;
		const resolver = new vue.CompilerOptionsResolver();
		resolver.addConfig($configRaw?.vueCompilerOptions ?? {}, $rootDir);
		const vueOptions = resolver.build();
		const vueLanguagePlugin = vue.createVueLanguagePlugin(ts$2, options.options, vueOptions, (id) => id);
		return { languagePlugins: [vueLanguagePlugin] };
	});
}

//#endregion
//#region src/tsc/index.ts
const debug = Debug("rolldown-plugin-dts:tsc");
debug(`loaded typescript: ${ts.version}`);
function createContext() {
	const programs = [];
	const files = /* @__PURE__ */ new Map();
	return {
		programs,
		files
	};
}
const globalContext = createContext();
const formatHost = {
	getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
	getNewLine: () => ts.sys.newLine,
	getCanonicalFileName: ts.sys.useCaseSensitiveFileNames ? (f) => f : (f) => f.toLowerCase()
};
const defaultCompilerOptions = {
	declaration: true,
	noEmit: false,
	emitDeclarationOnly: true,
	noEmitOnError: true,
	checkJs: false,
	declarationMap: false,
	skipLibCheck: true,
	target: 99,
	resolveJsonModule: true,
	moduleResolution: ts.ModuleResolutionKind.Bundler
};
function createOrGetTsModule(options) {
	const { id, entries, context = globalContext } = options;
	const program = context.programs.find((program$1) => {
		const roots = program$1.getRootFileNames();
		if (entries) return entries.every((entry) => roots.includes(entry));
		return roots.includes(id);
	});
	if (program) {
		const sourceFile = program.getSourceFile(id);
		if (sourceFile) return {
			program,
			file: sourceFile
		};
	}
	debug(`create program for module: ${id}`);
	const module = createTsProgram(options);
	debug(`created program for module: ${id}`);
	context.programs.push(module.program);
	return module;
}
/**
* Build the root project and all its dependencies projects.
* This is designed for a project (e.g. tsconfig.json) that has "references" to
* other composite projects (e.g., tsconfig.node.json and tsconfig.app.json).
* If `incremental` is `true`, the build result will be cached in the
* `.tsbuildinfo` file so that the next time the project is built (without
* changes) the build will be super fast. If `incremental` is `false`, the
* `.tsbuildinfo` file will only be written to the memory.
*/
function buildSolution(tsconfig, incremental, context) {
	debug(`building projects for ${tsconfig} with incremental: ${incremental}`);
	const system = (incremental ? createFsSystem : createMemorySystem)(context.files);
	const host = ts.createSolutionBuilderHost(system);
	const builder = ts.createSolutionBuilder(host, [tsconfig], {
		force: !incremental,
		verbose: true
	});
	const projects = [];
	const getCustomTransformers = (project) => {
		projects.push(project);
		return {};
	};
	const exitStatus = builder.build(void 0, void 0, void 0, getCustomTransformers);
	debug(`built solution for ${tsconfig} with exit status ${exitStatus}`);
	return Array.from(new Set(projects));
}
function findProjectContainingFile(projects, targetFile, fsSystem) {
	const resolvedTargetFile = fsSystem.resolvePath(targetFile);
	for (const tsconfigPath of projects) {
		const parsedConfig = parseTsconfig(tsconfigPath, fsSystem);
		if (parsedConfig && parsedConfig.fileNames.some((fileName) => fsSystem.resolvePath(fileName) === resolvedTargetFile)) return {
			parsedConfig,
			tsconfigPath
		};
	}
}
function parseTsconfig(tsconfigPath, fsSystem) {
	const diagnostics = [];
	const parsedConfig = ts.getParsedCommandLineOfConfigFile(tsconfigPath, void 0, {
		...fsSystem,
		onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
			diagnostics.push(diagnostic);
		}
	});
	if (diagnostics.length) throw new Error(`[rolldown-plugin-dts] Unable to read ${tsconfigPath}: ${ts.formatDiagnostics(diagnostics, formatHost)}`);
	return parsedConfig;
}
function createTsProgram({ entries, id, tsconfig, tsconfigRaw, incremental, vue, cwd, context = globalContext }) {
	const fsSystem = createFsSystem(context.files);
	const baseDir = tsconfig ? path.dirname(tsconfig) : cwd;
	const parsedConfig = ts.parseJsonConfigFileContent(tsconfigRaw, fsSystem, baseDir);
	if (tsconfig && parsedConfig.projectReferences?.length) {
		const projectPaths = buildSolution(tsconfig, incremental, context);
		debug(`collected projects: ${JSON.stringify(projectPaths)}`);
		const project = findProjectContainingFile(projectPaths, id, fsSystem);
		if (project) {
			debug(`Creating program for project: ${project.tsconfigPath}`);
			return createTsProgramFromParsedConfig({
				parsedConfig: project.parsedConfig,
				fsSystem,
				baseDir: path.dirname(project.tsconfigPath),
				id,
				entries,
				vue
			});
		}
	}
	return createTsProgramFromParsedConfig({
		parsedConfig,
		fsSystem,
		baseDir,
		id,
		entries,
		vue
	});
}
function createTsProgramFromParsedConfig({ parsedConfig, fsSystem, baseDir, id, entries, vue }) {
	const compilerOptions = {
		...defaultCompilerOptions,
		...parsedConfig.options,
		$configRaw: parsedConfig.raw,
		$rootDir: baseDir
	};
	const rootNames = [...new Set([id, ...entries || parsedConfig.fileNames].map((f) => fsSystem.resolvePath(f)))];
	const host = ts.createCompilerHost(compilerOptions, true);
	host.readFile = fsSystem.readFile;
	host.fileExists = fsSystem.fileExists;
	host.directoryExists = fsSystem.directoryExists;
	const createProgram = vue ? createVueProgramFactory(ts) : ts.createProgram;
	const program = createProgram({
		rootNames,
		options: compilerOptions,
		host,
		projectReferences: parsedConfig.projectReferences
	});
	const sourceFile = program.getSourceFile(id);
	if (!sourceFile) {
		debug(`source file not found in program: ${id}`);
		if (!fsSystem.fileExists(id)) {
			debug(`File ${id} does not exist on disk.`);
			throw new Error(`Source file not found: ${id}`);
		} else {
			debug(`File ${id} exists on disk.`);
			throw new Error(`Unable to load file ${id} from the program. This seems like a bug of rolldown-plugin-dts. Please report this issue to https://github.com/sxzz/rolldown-plugin-dts/issues`);
		}
	}
	return {
		program,
		file: sourceFile
	};
}
function tscEmit(tscOptions) {
	debug(`running tscEmit ${tscOptions.id}`);
	const module = createOrGetTsModule(tscOptions);
	const { program, file } = module;
	debug(`got source file: ${file.fileName}`);
	let dtsCode;
	let map;
	const { emitSkipped, diagnostics } = program.emit(file, (fileName, code) => {
		if (fileName.endsWith(".map")) {
			debug(`emit dts sourcemap: ${fileName}`);
			map = JSON.parse(code);
		} else {
			debug(`emit dts: ${fileName}`);
			dtsCode = code;
		}
	}, void 0, true, void 0, true);
	if (emitSkipped && diagnostics.length) return { error: ts.formatDiagnostics(diagnostics, formatHost) };
	if (!dtsCode && file.isDeclarationFile) {
		debug("nothing was emitted. fallback to sourceFile text.");
		dtsCode = file.getFullText();
	}
	return {
		code: dtsCode,
		map
	};
}

//#endregion
export { createContext, tscEmit };