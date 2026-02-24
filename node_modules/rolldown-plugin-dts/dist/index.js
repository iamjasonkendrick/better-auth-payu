import { RE_CSS, RE_DTS, RE_DTS_MAP, RE_JS, RE_NODE_MODULES, RE_TS, RE_VUE, filename_dts_to, filename_js_to_dts, filename_ts_to_dts } from "./filename-Dpr2dKWZ.js";
import path from "node:path";
import Debug from "debug";
import _generate from "@babel/generator";
import { parse } from "@babel/parser";
import * as t from "@babel/types";
import { isDeclarationType, isTypeOf, resolveString } from "ast-kit";
import { fork, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createBirpc } from "birpc";
import { ResolverFactory, isolatedDeclaration } from "rolldown/experimental";
import process from "node:process";
import { getTsconfig, parseTsconfig } from "get-tsconfig";
import { createResolver } from "dts-resolver";

//#region src/dts-input.ts
function createDtsInputPlugin() {
	return {
		name: "rolldown-plugin-dts:dts-input",
		options(options) {
			return {
				treeshake: options.treeshake !== false ? {
					...options.treeshake === true ? {} : options.treeshake,
					moduleSideEffects: false
				} : false,
				...options
			};
		},
		outputOptions(options) {
			return {
				...options,
				entryFileNames(chunk) {
					if (chunk.name.endsWith(".d")) return "[name].ts";
					return "[name].d.ts";
				}
			};
		}
	};
}

//#endregion
//#region node_modules/.pnpm/estree-walker@3.0.3/node_modules/estree-walker/src/walker.js
/**
* @typedef { import('estree').Node} Node
* @typedef {{
*   skip: () => void;
*   remove: () => void;
*   replace: (node: Node) => void;
* }} WalkerContext
*/
var WalkerBase = class {
	constructor() {
		/** @type {boolean} */
		this.should_skip = false;
		/** @type {boolean} */
		this.should_remove = false;
		/** @type {Node | null} */
		this.replacement = null;
		/** @type {WalkerContext} */
		this.context = {
			skip: () => this.should_skip = true,
			remove: () => this.should_remove = true,
			replace: (node) => this.replacement = node
		};
	}
	/**
	* @template {Node} Parent
	* @param {Parent | null | undefined} parent
	* @param {keyof Parent | null | undefined} prop
	* @param {number | null | undefined} index
	* @param {Node} node
	*/
	replace(parent, prop, index, node) {
		if (parent && prop) if (index != null)
 /** @type {Array<Node>} */ parent[prop][index] = node;
		else
 /** @type {Node} */ parent[prop] = node;
	}
	/**
	* @template {Node} Parent
	* @param {Parent | null | undefined} parent
	* @param {keyof Parent | null | undefined} prop
	* @param {number | null | undefined} index
	*/
	remove(parent, prop, index) {
		if (parent && prop) if (index !== null && index !== void 0)
 /** @type {Array<Node>} */ parent[prop].splice(index, 1);
		else delete parent[prop];
	}
};

//#endregion
//#region node_modules/.pnpm/estree-walker@3.0.3/node_modules/estree-walker/src/sync.js
/**
* @typedef { import('estree').Node} Node
* @typedef { import('./walker.js').WalkerContext} WalkerContext
* @typedef {(
*    this: WalkerContext,
*    node: Node,
*    parent: Node | null,
*    key: string | number | symbol | null | undefined,
*    index: number | null | undefined
* ) => void} SyncHandler
*/
var SyncWalker = class extends WalkerBase {
	/**
	*
	* @param {SyncHandler} [enter]
	* @param {SyncHandler} [leave]
	*/
	constructor(enter, leave) {
		super();
		/** @type {boolean} */
		this.should_skip = false;
		/** @type {boolean} */
		this.should_remove = false;
		/** @type {Node | null} */
		this.replacement = null;
		/** @type {WalkerContext} */
		this.context = {
			skip: () => this.should_skip = true,
			remove: () => this.should_remove = true,
			replace: (node) => this.replacement = node
		};
		/** @type {SyncHandler | undefined} */
		this.enter = enter;
		/** @type {SyncHandler | undefined} */
		this.leave = leave;
	}
	/**
	* @template {Node} Parent
	* @param {Node} node
	* @param {Parent | null} parent
	* @param {keyof Parent} [prop]
	* @param {number | null} [index]
	* @returns {Node | null}
	*/
	visit(node, parent, prop, index) {
		if (node) {
			if (this.enter) {
				const _should_skip = this.should_skip;
				const _should_remove = this.should_remove;
				const _replacement = this.replacement;
				this.should_skip = false;
				this.should_remove = false;
				this.replacement = null;
				this.enter.call(this.context, node, parent, prop, index);
				if (this.replacement) {
					node = this.replacement;
					this.replace(parent, prop, index, node);
				}
				if (this.should_remove) this.remove(parent, prop, index);
				const skipped = this.should_skip;
				const removed = this.should_remove;
				this.should_skip = _should_skip;
				this.should_remove = _should_remove;
				this.replacement = _replacement;
				if (skipped) return node;
				if (removed) return null;
			}
			/** @type {keyof Node} */
			let key;
			for (key in node) {
				/** @type {unknown} */
				const value = node[key];
				if (value && typeof value === "object") {
					if (Array.isArray(value)) {
						const nodes = value;
						for (let i = 0; i < nodes.length; i += 1) {
							const item = nodes[i];
							if (isNode(item)) {
								if (!this.visit(item, node, key, i)) i--;
							}
						}
					} else if (isNode(value)) this.visit(value, node, key, null);
				}
			}
			if (this.leave) {
				const _replacement = this.replacement;
				const _should_remove = this.should_remove;
				this.replacement = null;
				this.should_remove = false;
				this.leave.call(this.context, node, parent, prop, index);
				if (this.replacement) {
					node = this.replacement;
					this.replace(parent, prop, index, node);
				}
				if (this.should_remove) this.remove(parent, prop, index);
				const removed = this.should_remove;
				this.replacement = _replacement;
				this.should_remove = _should_remove;
				if (removed) return null;
			}
		}
		return node;
	}
};
/**
* Ducktype a node.
*
* @param {unknown} value
* @returns {value is Node}
*/
function isNode(value) {
	return value !== null && typeof value === "object" && "type" in value && typeof value.type === "string";
}

//#endregion
//#region node_modules/.pnpm/estree-walker@3.0.3/node_modules/estree-walker/src/index.js
/**
* @typedef {import('estree').Node} Node
* @typedef {import('./sync.js').SyncHandler} SyncHandler
* @typedef {import('./async.js').AsyncHandler} AsyncHandler
*/
/**
* @param {Node} ast
* @param {{
*   enter?: SyncHandler
*   leave?: SyncHandler
* }} walker
* @returns {Node | null}
*/
function walk(ast, { enter, leave }) {
	const instance = new SyncWalker(enter, leave);
	return instance.visit(ast, null);
}

//#endregion
//#region src/fake-js.ts
const generate = _generate.default || _generate;
function createFakeJsPlugin({ dtsInput, sourcemap }) {
	let symbolIdx = 0;
	const identifierMap = Object.create(null);
	const symbolMap = /* @__PURE__ */ new Map();
	const commentsMap = /* @__PURE__ */ new Map();
	const typeOnlyMap = /* @__PURE__ */ new Map();
	return {
		name: "rolldown-plugin-dts:fake-js",
		outputOptions(options) {
			if (options.format === "cjs" || options.format === "commonjs") throw new Error("[rolldown-plugin-dts] Cannot bundle dts files with `cjs` format.");
			return {
				...options,
				sourcemap: sourcemap ? true : options.sourcemap,
				entryFileNames: options.entryFileNames ?? (dtsInput ? "[name].ts" : void 0),
				chunkFileNames(chunk) {
					const original = (typeof options.chunkFileNames === "function" ? options.chunkFileNames(chunk) : options.chunkFileNames) || "[name]-[hash].js";
					if (!original.includes(".d") && chunk.name.endsWith(".d")) return filename_js_to_dts(original).replace("[name]", chunk.name.slice(0, -2));
					return original;
				}
			};
		},
		transform: {
			filter: { id: RE_DTS },
			handler: transform
		},
		renderChunk,
		generateBundle: sourcemap ? void 0 : (options, bundle) => {
			for (const chunk of Object.values(bundle)) {
				if (!RE_DTS_MAP.test(chunk.fileName)) continue;
				delete bundle[chunk.fileName];
			}
		}
	};
	function transform(code, id) {
		const file = parse(code, {
			plugins: [["typescript", { dts: true }]],
			sourceType: "module"
		});
		const { program, comments } = file;
		const typeOnlyIds = [];
		if (comments) {
			const directives = collectReferenceDirectives(comments);
			commentsMap.set(id, directives);
		}
		const appendStmts = [];
		const namespaceStmts = /* @__PURE__ */ new Map();
		for (const [i, stmt] of program.body.entries()) {
			const setStmt = (node) => program.body[i] = node;
			if (rewriteImportExport(stmt, setStmt, typeOnlyIds)) continue;
			const sideEffect = stmt.type === "TSModuleDeclaration" && stmt.kind !== "namespace";
			if (sideEffect && id.endsWith(".vue.d.ts") && code.slice(stmt.start, stmt.end).includes("__VLS_")) continue;
			const isDefaultExport = stmt.type === "ExportDefaultDeclaration";
			const isDecl = isTypeOf(stmt, ["ExportNamedDeclaration", "ExportDefaultDeclaration"]) && stmt.declaration;
			const decl = isDecl ? stmt.declaration : stmt;
			const setDecl = isDecl ? (node) => stmt.declaration = node : setStmt;
			if (decl.type !== "TSDeclareFunction" && !isDeclarationType(decl)) continue;
			if (isTypeOf(decl, [
				"TSEnumDeclaration",
				"ClassDeclaration",
				"FunctionDeclaration",
				"TSDeclareFunction",
				"TSModuleDeclaration",
				"VariableDeclaration"
			])) decl.declare = true;
			const bindings = [];
			if (decl.type === "VariableDeclaration") bindings.push(...decl.declarations.map((decl$1) => decl$1.id));
			else if ("id" in decl && decl.id) {
				let binding = decl.id;
				binding = sideEffect ? t.identifier(`_${getIdentifierIndex("")}`) : binding;
				bindings.push(binding);
			} else {
				const binding = t.identifier("export_default");
				bindings.push(binding);
				decl.id = binding;
			}
			const deps = collectDependencies(decl, namespaceStmts);
			const elements = [
				t.numericLiteral(0),
				...deps.map((dep) => t.arrowFunctionExpression([], dep)),
				...sideEffect ? [t.callExpression(t.identifier("sideEffect"), [])] : []
			];
			const runtime = t.arrayExpression(elements);
			if (decl !== stmt) {
				decl.innerComments = stmt.innerComments;
				decl.leadingComments = stmt.leadingComments;
				decl.trailingComments = stmt.trailingComments;
			}
			const symbolId = registerSymbol({
				decl,
				deps,
				bindings
			});
			elements[0] = t.numericLiteral(symbolId);
			const runtimeAssignment = {
				type: "VariableDeclaration",
				kind: "var",
				declarations: [{
					type: "VariableDeclarator",
					id: {
						...bindings[0],
						typeAnnotation: null
					},
					init: runtime
				}, ...bindings.slice(1).map((binding) => ({
					type: "VariableDeclarator",
					id: {
						...binding,
						typeAnnotation: null
					}
				}))]
			};
			if (isDefaultExport) {
				appendStmts.push(t.exportNamedDeclaration(null, [t.exportSpecifier(bindings[0], t.identifier("default"))]));
				setStmt(runtimeAssignment);
			} else setDecl(runtimeAssignment);
		}
		program.body = [
			...Array.from(namespaceStmts.values()).map(({ stmt }) => stmt),
			...program.body,
			...appendStmts
		];
		typeOnlyMap.set(id, typeOnlyIds);
		const result = generate(file, {
			comments: false,
			sourceMaps: sourcemap,
			sourceFileName: id
		});
		return result;
	}
	function renderChunk(code, chunk) {
		if (!RE_DTS.test(chunk.fileName)) return;
		const typeOnlyIds = [];
		for (const module of chunk.moduleIds) {
			const ids = typeOnlyMap.get(module);
			if (ids) typeOnlyIds.push(...ids);
		}
		const file = parse(code, { sourceType: "module" });
		const { program } = file;
		program.body = patchTsNamespace(program.body);
		program.body = program.body.map((node) => {
			if (isHelperImport(node)) return null;
			if (patchImportExport(node, typeOnlyIds)) return node;
			if (node.type !== "VariableDeclaration") return node;
			const [decl] = node.declarations;
			if (decl.init?.type !== "ArrayExpression" || !decl.init.elements[0]) return null;
			const [symbolIdNode, ...depsFns] = decl.init.elements;
			if (symbolIdNode?.type !== "NumericLiteral") return null;
			const symbolId = symbolIdNode.value;
			const original = getSymbol(symbolId);
			for (const [i, decl$1] of node.declarations.entries()) {
				const transformedBinding = {
					...decl$1.id,
					typeAnnotation: original.bindings[i].typeAnnotation
				};
				overwriteNode(original.bindings[i], transformedBinding);
			}
			const transformedDeps = depsFns.filter((node$1) => node$1?.type === "ArrowFunctionExpression").map((node$1) => node$1.body);
			if (original.deps.length) for (let i = 0; i < original.deps.length; i++) {
				const originalDep = original.deps[i];
				if (originalDep.replace) originalDep.replace(transformedDeps[i]);
				else Object.assign(originalDep, transformedDeps[i]);
			}
			return inheritNodeComments(node, original.decl);
		}).filter((node) => !!node);
		if (program.body.length === 0) return "export { };";
		const comments = /* @__PURE__ */ new Set();
		const commentsValue = /* @__PURE__ */ new Set();
		for (const id of chunk.moduleIds) {
			const preserveComments = commentsMap.get(id);
			if (preserveComments) {
				preserveComments.forEach((c) => {
					const id$1 = c.type + c.value;
					if (commentsValue.has(id$1)) return;
					commentsValue.add(id$1);
					comments.add(c);
				});
				commentsMap.delete(id);
			}
		}
		if (comments.size) {
			program.body[0].leadingComments ||= [];
			program.body[0].leadingComments.unshift(...comments);
		}
		const result = generate(file, {
			comments: true,
			sourceMaps: sourcemap,
			sourceFileName: chunk.fileName
		});
		return result;
	}
	function getIdentifierIndex(name) {
		if (name in identifierMap) return identifierMap[name]++;
		return identifierMap[name] = 0;
	}
	function registerSymbol(info) {
		const symbolId = symbolIdx++;
		symbolMap.set(symbolId, info);
		return symbolId;
	}
	function getSymbol(symbolId) {
		return symbolMap.get(symbolId);
	}
	function collectDependencies(node, namespaceStmts) {
		const deps = /* @__PURE__ */ new Set();
		const seen = /* @__PURE__ */ new Set();
		walk(node, { leave(node$1) {
			if (node$1.type === "ExportNamedDeclaration") {
				for (const specifier of node$1.specifiers) if (specifier.type === "ExportSpecifier") addDependency(specifier.local);
			} else if (node$1.type === "TSInterfaceDeclaration" && node$1.extends) for (const heritage of node$1.extends || []) addDependency(TSEntityNameToRuntime(heritage.expression));
			else if (node$1.type === "ClassDeclaration") {
				if (node$1.superClass) addDependency(node$1.superClass);
				if (node$1.implements) for (const implement of node$1.implements) addDependency(TSEntityNameToRuntime(implement.expression));
			} else if (isTypeOf(node$1, [
				"ObjectMethod",
				"ObjectProperty",
				"ClassProperty",
				"TSPropertySignature",
				"TSDeclareMethod"
			])) {
				if (node$1.computed && isReferenceId(node$1.key)) addDependency(node$1.key);
				if ("value" in node$1 && isReferenceId(node$1.value)) addDependency(node$1.value);
			} else if (node$1.type === "TSTypeReference") addDependency(TSEntityNameToRuntime(node$1.typeName));
			else if (node$1.type === "TSTypeQuery") {
				if (seen.has(node$1.exprName)) return;
				if (node$1.exprName.type !== "TSImportType") addDependency(TSEntityNameToRuntime(node$1.exprName));
			} else if (node$1.type === "TSImportType") {
				seen.add(node$1);
				const source = node$1.argument;
				const imported = node$1.qualifier;
				const dep = importNamespace(node$1, imported, source, namespaceStmts);
				addDependency(dep);
			}
		} });
		return Array.from(deps);
		function addDependency(node$1) {
			if (node$1.type === "Identifier" && node$1.name === "this") return;
			deps.add(node$1);
		}
	}
	function importNamespace(node, imported, source, namespaceStmts) {
		const sourceText = source.value.replaceAll(/\W/g, "_");
		let local = t.identifier(`${sourceText}${getIdentifierIndex(sourceText)}`);
		if (namespaceStmts.has(source.value)) local = namespaceStmts.get(source.value).local;
		else namespaceStmts.set(source.value, {
			stmt: t.importDeclaration([t.importNamespaceSpecifier(local)], source),
			local
		});
		if (imported) {
			const importedLeft = getIdFromTSEntityName(imported);
			overwriteNode(importedLeft, t.tsQualifiedName(local, { ...importedLeft }));
			local = imported;
		}
		let replacement = node;
		if (node.typeParameters) {
			overwriteNode(node, t.tsTypeReference(local, node.typeParameters));
			replacement = local;
		} else overwriteNode(node, local);
		const dep = {
			...TSEntityNameToRuntime(local),
			replace(newNode) {
				overwriteNode(replacement, newNode);
			}
		};
		return dep;
	}
}
const REFERENCE_RE = /\/\s*<reference\s+(?:path|types)=/;
function collectReferenceDirectives(comment, negative = false) {
	return comment.filter((c) => REFERENCE_RE.test(c.value) !== negative);
}
function TSEntityNameToRuntime(node) {
	if (node.type === "Identifier") return node;
	const left = TSEntityNameToRuntime(node.left);
	return Object.assign(node, t.memberExpression(left, node.right));
}
function getIdFromTSEntityName(node) {
	if (node.type === "Identifier") return node;
	return getIdFromTSEntityName(node.left);
}
function isReferenceId(node) {
	return !!node && (node.type === "Identifier" || node.type === "MemberExpression");
}
function isHelperImport(node) {
	return node.type === "ImportDeclaration" && node.specifiers.length === 1 && node.specifiers.every((spec) => spec.type === "ImportSpecifier" && spec.imported.type === "Identifier" && ["__export", "__reExport"].includes(spec.imported.name));
}
function patchImportExport(node, typeOnlyIds) {
	if (isTypeOf(node, [
		"ImportDeclaration",
		"ExportAllDeclaration",
		"ExportNamedDeclaration"
	])) {
		if (typeOnlyIds.length && node.type === "ExportNamedDeclaration") for (const spec of node.specifiers) {
			const name = resolveString(spec.exported);
			if (typeOnlyIds.includes(name)) if (spec.type === "ExportSpecifier") spec.exportKind = "type";
			else node.exportKind = "type";
		}
		if (node.source?.value && RE_DTS.test(node.source.value)) {
			node.source.value = filename_dts_to(node.source.value, "js");
			return true;
		}
	}
}
function patchTsNamespace(nodes) {
	const emptyObjectAssignments = /* @__PURE__ */ new Map();
	const removed = /* @__PURE__ */ new Set();
	for (const [i, node] of nodes.entries()) {
		if (node.type === "VariableDeclaration" && node.declarations.length === 1 && node.declarations[0].id.type === "Identifier" && node.declarations[0].init?.type === "ObjectExpression" && node.declarations[0].init.properties.length === 0) emptyObjectAssignments.set(node.declarations[0].id.name, node);
		if (node.type !== "ExpressionStatement" || node.expression.type !== "CallExpression" || node.expression.callee.type !== "Identifier" || !node.expression.callee.name.startsWith("__export")) continue;
		const [binding, exports] = node.expression.arguments;
		if (binding.type !== "Identifier") continue;
		const bindingText = binding.name;
		if (emptyObjectAssignments.has(bindingText)) {
			const emptyNode = emptyObjectAssignments.get(bindingText);
			emptyObjectAssignments.delete(bindingText);
			removed.add(emptyNode);
		}
		nodes[i] = {
			type: "TSModuleDeclaration",
			id: binding,
			kind: "namespace",
			declare: true,
			body: {
				type: "TSModuleBlock",
				body: [{
					type: "ExportNamedDeclaration",
					specifiers: exports.properties.filter((property) => property.type === "ObjectProperty").map((property) => {
						const local = property.value.body;
						const exported = property.key;
						return t.exportSpecifier(local, exported);
					}),
					source: null,
					declaration: null
				}]
			}
		};
	}
	return nodes.filter((node) => !removed.has(node));
}
function rewriteImportExport(node, set, typeOnlyIds) {
	if (node.type === "ImportDeclaration" || node.type === "ExportNamedDeclaration" && !node.declaration) {
		for (const specifier of node.specifiers) {
			if ("exportKind" in specifier && specifier.exportKind === "type" || "exportKind" in node && node.exportKind === "type") typeOnlyIds.push(resolveString(specifier.exported));
			if (specifier.type === "ImportSpecifier") specifier.importKind = "value";
			else if (specifier.type === "ExportSpecifier") specifier.exportKind = "value";
		}
		if (node.type === "ImportDeclaration") node.importKind = "value";
		else if (node.type === "ExportNamedDeclaration") node.exportKind = "value";
		return true;
	} else if (node.type === "ExportAllDeclaration") {
		node.exportKind = "value";
		return true;
	} else if (node.type === "TSImportEqualsDeclaration") {
		if (node.moduleReference.type === "TSExternalModuleReference") set({
			type: "ImportDeclaration",
			specifiers: [{
				type: "ImportDefaultSpecifier",
				local: node.id
			}],
			source: node.moduleReference.expression
		});
		return true;
	} else if (node.type === "TSExportAssignment" && node.expression.type === "Identifier") {
		set({
			type: "ExportNamedDeclaration",
			specifiers: [{
				type: "ExportSpecifier",
				local: node.expression,
				exported: {
					type: "Identifier",
					name: "default"
				}
			}]
		});
		return true;
	} else if (node.type === "ExportDefaultDeclaration" && node.declaration.type === "Identifier") {
		set({
			type: "ExportNamedDeclaration",
			specifiers: [{
				type: "ExportSpecifier",
				local: node.declaration,
				exported: t.identifier("default")
			}]
		});
		return true;
	}
	return false;
}
function overwriteNode(node, newNode) {
	for (const key of Object.keys(node)) delete node[key];
	Object.assign(node, newNode);
	return node;
}
function inheritNodeComments(oldNode, newNode) {
	newNode.leadingComments ||= [];
	const leadingComments = oldNode.leadingComments?.filter((comment) => comment.value.startsWith("#"));
	if (leadingComments) newNode.leadingComments.unshift(...leadingComments);
	newNode.leadingComments = collectReferenceDirectives(newNode.leadingComments, true);
	return newNode;
}

//#endregion
//#region src/generate.ts
const debug$1 = Debug("rolldown-plugin-dts:generate");
const WORKER_URL = "./tsc/worker.js";
const spawnAsync = (...args) => new Promise((resolve, reject) => {
	const child = spawn(...args);
	child.on("close", () => resolve());
	child.on("error", (error) => reject(error));
});
function createGeneratePlugin({ tsconfig, tsconfigRaw, incremental, cwd, isolatedDeclarations, emitDtsOnly, vue, parallel, eager, tsgo }) {
	const dtsMap = /* @__PURE__ */ new Map();
	/**
	* A map of input id to output file name
	*
	* @example
	*
	* inputAlias = new Map([
	*   ['/absolute/path/to/src/source_file.ts', 'dist/foo/index'],
	* ])
	*/
	const inputAliasMap = /* @__PURE__ */ new Map();
	let childProcess;
	let rpc;
	let tscModule;
	let tscContext;
	let tsgoDist;
	if (!tsgo && parallel) {
		childProcess = fork(new URL(WORKER_URL, import.meta.url), { stdio: "inherit" });
		rpc = createBirpc({}, {
			post: (data) => childProcess.send(data),
			on: (fn) => childProcess.on("message", fn)
		});
	}
	return {
		name: "rolldown-plugin-dts:generate",
		async buildStart(options) {
			if (tsgo) tsgoDist = await runTsgo(cwd, tsconfig);
			else if (!parallel && (!isolatedDeclarations || vue)) {
				tscModule = await import("./tsc-qM2loyiG.js");
				tscContext = eager ? void 0 : tscModule.createContext();
			}
			if (!Array.isArray(options.input)) for (const [name, id] of Object.entries(options.input)) {
				debug$1("resolving input alias %s -> %s", name, id);
				let resolved = await this.resolve(id);
				if (!id.startsWith("./")) resolved ||= await this.resolve(`./${id}`);
				const resolvedId = resolved?.id || id;
				debug$1("resolved input alias %s -> %s", id, resolvedId);
				inputAliasMap.set(resolvedId, name);
			}
		},
		outputOptions(options) {
			return {
				...options,
				entryFileNames(chunk) {
					const original = (typeof options.entryFileNames === "function" ? options.entryFileNames(chunk) : options.entryFileNames) || "[name].js";
					if (!chunk.name.endsWith(".d")) return original;
					if (RE_DTS.test(original)) return original.replace("[name]", chunk.name.slice(0, -2));
					return original.replace(RE_JS, ".$1ts");
				}
			};
		},
		resolveId(id) {
			if (dtsMap.has(id)) {
				debug$1("resolve dts id %s", id);
				return { id };
			}
		},
		transform: {
			order: "pre",
			filter: { id: {
				include: [RE_TS, RE_VUE],
				exclude: [RE_DTS, RE_NODE_MODULES]
			} },
			handler(code, id) {
				const mod = this.getModuleInfo(id);
				const isEntry = !!mod?.isEntry;
				const dtsId = filename_ts_to_dts(id);
				dtsMap.set(dtsId, {
					code,
					id,
					isEntry
				});
				debug$1("register dts source: %s", id);
				if (isEntry) {
					const name = inputAliasMap.get(id);
					this.emitFile({
						type: "chunk",
						id: dtsId,
						name: name ? `${name}.d` : void 0
					});
				}
				if (emitDtsOnly) return "export { }";
			}
		},
		load: {
			filter: { id: {
				include: [RE_DTS],
				exclude: [RE_NODE_MODULES]
			} },
			async handler(dtsId) {
				if (!dtsMap.has(dtsId)) return;
				const { code, id } = dtsMap.get(dtsId);
				let dtsCode;
				let map;
				debug$1("generate dts %s from %s", dtsId, id);
				if (tsgo) {
					if (RE_VUE.test(id)) throw new Error("tsgo does not support Vue files.");
					const dtsPath = path.resolve(tsgoDist, path.relative(path.resolve(cwd), filename_ts_to_dts(id)));
					if (existsSync(dtsPath)) dtsCode = await readFile(dtsPath, "utf8");
					else {
						debug$1("[tsgo]", dtsPath, "is missing");
						throw new Error(`tsgo did not generate dts file for ${id}, please check your tsconfig.`);
					}
				} else if (isolatedDeclarations && !RE_VUE.test(id)) {
					const result = isolatedDeclaration(id, code, isolatedDeclarations);
					if (result.errors.length) {
						const [error] = result.errors;
						return this.error({
							message: error.message,
							frame: error.codeframe
						});
					}
					dtsCode = result.code;
					if (result.map) {
						map = result.map;
						map.sourcesContent = void 0;
					}
				} else {
					const entries = eager ? void 0 : Array.from(dtsMap.values()).filter((v) => v.isEntry).map((v) => v.id);
					const options = {
						tsconfig,
						tsconfigRaw,
						incremental,
						cwd,
						entries,
						id,
						vue,
						context: tscContext
					};
					let result;
					if (parallel) result = await rpc.tscEmit(options);
					else result = tscModule.tscEmit(options);
					if (result.error) return this.error(result.error);
					dtsCode = result.code;
					map = result.map;
				}
				return {
					code: dtsCode || "",
					moduleSideEffects: false,
					map
				};
			}
		},
		generateBundle: emitDtsOnly ? (options, bundle) => {
			for (const fileName of Object.keys(bundle)) if (bundle[fileName].type === "chunk" && !RE_DTS.test(fileName) && !RE_DTS_MAP.test(fileName)) delete bundle[fileName];
		} : void 0,
		async buildEnd() {
			childProcess?.kill();
			if (!debug$1.enabled && tsgoDist) await rm(tsgoDist, {
				recursive: true,
				force: true
			}).catch(() => {});
			tscContext = tsgoDist = void 0;
		}
	};
}
async function runTsgo(root, tsconfig) {
	const tsgoPkg = import.meta.resolve("@typescript/native-preview/package.json");
	const { default: getExePath } = await import(new URL("./lib/getExePath.js", tsgoPkg).href);
	const tsgo = getExePath();
	const tsgoDist = await mkdtemp(path.join(tmpdir(), "rolldown-plugin-dts-"));
	debug$1("[tsgo] tsgoDist", tsgoDist);
	await spawnAsync(tsgo, [
		"--noEmit",
		"false",
		"--declaration",
		"--emitDeclarationOnly",
		...tsconfig ? ["-p", tsconfig] : [],
		"--outDir",
		tsgoDist,
		"--rootDir",
		root,
		"--noCheck"
	], { stdio: "inherit" });
	return tsgoDist;
}

//#endregion
//#region src/options.ts
let warnedTsgo = false;
function resolveOptions({ cwd = process.cwd(), tsconfig, incremental = false, compilerOptions = {}, tsconfigRaw: overriddenTsconfigRaw = {}, isolatedDeclarations, sourcemap, dtsInput = false, emitDtsOnly = false, resolve = false, vue = false, parallel = false, eager = false, tsgo = false }) {
	let resolvedTsconfig;
	if (tsconfig === true || tsconfig == null) {
		const { config, path: path$1 } = getTsconfig(cwd) || {};
		tsconfig = path$1;
		resolvedTsconfig = config;
	} else if (typeof tsconfig === "string") {
		tsconfig = path.resolve(cwd || process.cwd(), tsconfig);
		resolvedTsconfig = parseTsconfig(tsconfig);
	} else tsconfig = void 0;
	compilerOptions = {
		...resolvedTsconfig?.compilerOptions,
		...compilerOptions
	};
	incremental ||= compilerOptions.incremental || !!compilerOptions.tsBuildInfoFile;
	sourcemap ??= !!compilerOptions.declarationMap;
	compilerOptions.declarationMap = sourcemap;
	const tsconfigRaw = {
		...resolvedTsconfig,
		...overriddenTsconfigRaw,
		compilerOptions
	};
	if (isolatedDeclarations == null) isolatedDeclarations = !!compilerOptions?.isolatedDeclarations;
	if (isolatedDeclarations === true) isolatedDeclarations = {};
	if (isolatedDeclarations) {
		isolatedDeclarations.stripInternal ??= !!compilerOptions?.stripInternal;
		isolatedDeclarations.sourcemap = !!compilerOptions.declarationMap;
	}
	if (tsgo && !warnedTsgo) {
		console.warn("The `tsgo` option is experimental and may change in the future.");
		warnedTsgo = true;
	}
	return {
		cwd,
		tsconfig,
		tsconfigRaw,
		incremental,
		isolatedDeclarations,
		sourcemap,
		dtsInput,
		emitDtsOnly,
		resolve,
		vue,
		parallel,
		eager,
		tsgo
	};
}

//#endregion
//#region src/resolver.ts
function createDtsResolvePlugin({ tsconfig, resolve }) {
	const resolver = createResolver({
		tsconfig,
		resolveNodeModules: !!resolve,
		ResolverFactory
	});
	return {
		name: "rolldown-plugin-dts:resolver",
		resolveId: {
			order: "pre",
			async handler(id, importer, options) {
				const external = {
					id,
					external: true,
					moduleSideEffects: false
				};
				if (!importer || !RE_DTS.test(importer)) return;
				if (RE_CSS.test(id)) return {
					id,
					external: true,
					moduleSideEffects: false
				};
				let resolution = resolver(id, importer);
				resolution &&= path.normalize(resolution);
				if (!resolution || !RE_TS.test(resolution) && !RE_VUE.test(resolution)) {
					const result = await this.resolve(id, importer, options);
					if (!result || !RE_TS.test(result.id)) return external;
					resolution = result.id;
				}
				if (!RE_NODE_MODULES.test(importer) && RE_NODE_MODULES.test(resolution)) {
					let shouldResolve;
					if (typeof resolve === "boolean") shouldResolve = resolve;
					else shouldResolve = resolve.some((pattern) => typeof pattern === "string" ? id === pattern : pattern.test(id));
					if (!shouldResolve) return external;
				}
				if (RE_TS.test(resolution) && !RE_DTS.test(resolution) || RE_VUE.test(resolution)) {
					await this.load({ id: resolution });
					resolution = filename_ts_to_dts(resolution);
				}
				if (RE_DTS.test(resolution)) return resolution;
			}
		}
	};
}

//#endregion
//#region src/index.ts
const debug = Debug("rolldown-plugin-dts:options");
function dts(options = {}) {
	debug("resolving dts options");
	const resolved = resolveOptions(options);
	debug("resolved dts options %o", resolved);
	const plugins = [];
	if (options.dtsInput) plugins.push(createDtsInputPlugin());
	else plugins.push(createGeneratePlugin(resolved));
	plugins.push(createDtsResolvePlugin(resolved), createFakeJsPlugin(resolved));
	return plugins;
}

//#endregion
export { RE_CSS, RE_DTS, RE_DTS_MAP, RE_JS, RE_NODE_MODULES, RE_TS, RE_VUE, createFakeJsPlugin, createGeneratePlugin, dts, resolveOptions };