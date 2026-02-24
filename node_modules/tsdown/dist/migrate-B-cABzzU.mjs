import { logger } from "./logger-CdK2zFTY.mjs";
import { version } from "./package--rzHLoNS.mjs";
import process from "node:process";
import { bold, green, underline } from "ansis";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";

//#region src/migrate.ts
async function migrate({ cwd, dryRun }) {
	if (dryRun) logger.info("Dry run enabled. No changes were made.");
	else {
		const rl = createInterface({
			input: process.stdin,
			output: process.stdout
		});
		logger.warn(`\n\nBefore proceeding, review the migration guide at ${underline`https://tsdown.dev/guide/migrate-from-tsup`}, as this process will modify your files.\nUncommitted changes will be lost. Use the ${green`--dry-run`} flag to preview changes without applying them.`);
		const input = await rl.question(bold`Continue? (Y/n) `);
		rl.close();
		const confirm = input.toLowerCase() === "y" || input === "";
		if (!confirm) {
			logger.error("Migration cancelled.");
			process.exitCode = 1;
			return;
		}
	}
	if (cwd) process.chdir(cwd);
	let migrated = await migratePackageJson(dryRun);
	if (await migrateTsupConfig(dryRun)) migrated = true;
	if (migrated) logger.success("Migration completed. Remember to run install command with your package manager.");
	else {
		logger.error("No migration performed.");
		process.exitCode = 1;
	}
}
async function migratePackageJson(dryRun) {
	if (!existsSync("package.json")) {
		logger.error("No package.json found");
		return false;
	}
	const pkgRaw = await readFile("package.json", "utf-8");
	let pkg = JSON.parse(pkgRaw);
	const semver = `^${version}`;
	let found = false;
	if (pkg.dependencies?.tsup) {
		logger.info("Migrating `dependencies` to tsdown.");
		found = true;
		pkg.dependencies = renameKey(pkg.dependencies, "tsup", "tsdown", semver);
	}
	if (pkg.devDependencies?.tsup) {
		logger.info("Migrating `devDependencies` to tsdown.");
		found = true;
		pkg.devDependencies = renameKey(pkg.devDependencies, "tsup", "tsdown", semver);
	}
	if (pkg.peerDependencies?.tsup) {
		logger.info("Migrating `peerDependencies` to tsdown.");
		found = true;
		pkg.peerDependencies = renameKey(pkg.peerDependencies, "tsup", "tsdown", "*");
	}
	if (pkg.scripts) {
		for (const key of Object.keys(pkg.scripts)) if (pkg.scripts[key].includes("tsup")) {
			logger.info(`Migrating \`${key}\` script to tsdown`);
			found = true;
			pkg.scripts[key] = pkg.scripts[key].replaceAll(/tsup(?:-node)?/g, "tsdown");
		}
	}
	if (pkg.tsup) {
		logger.info("Migrating `tsup` field in package.json to `tsdown`.");
		found = true;
		pkg = renameKey(pkg, "tsup", "tsdown");
	}
	if (!found) {
		logger.warn("No tsup-related fields found in package.json");
		return false;
	}
	const pkgStr = `${JSON.stringify(pkg, null, 2)}\n`;
	if (dryRun) {
		const { createPatch } = await import("diff");
		logger.info("[dry-run] package.json:");
		console.info(createPatch("package.json", pkgRaw, pkgStr));
	} else {
		await writeFile("package.json", pkgStr);
		logger.success("Migrated `package.json`");
	}
	return true;
}
const TSUP_FILES = [
	"tsup.config.ts",
	"tsup.config.cts",
	"tsup.config.mts",
	"tsup.config.js",
	"tsup.config.cjs",
	"tsup.config.mjs",
	"tsup.config.json"
];
async function migrateTsupConfig(dryRun) {
	let found = false;
	for (const file of TSUP_FILES) {
		if (!existsSync(file)) continue;
		logger.info(`Found \`${file}\``);
		found = true;
		const tsupConfigRaw = await readFile(file, "utf-8");
		const tsupConfig = tsupConfigRaw.replaceAll(/\btsup\b/g, "tsdown").replaceAll(/\bTSUP\b/g, "TSDOWN");
		const renamed = file.replaceAll("tsup", "tsdown");
		if (dryRun) {
			const { createTwoFilesPatch } = await import("diff");
			logger.info(`[dry-run] ${file} -> ${renamed}:`);
			console.info(createTwoFilesPatch(file, renamed, tsupConfigRaw, tsupConfig));
		} else {
			await writeFile(renamed, tsupConfig, "utf8");
			await unlink(file);
			logger.success(`Migrated \`${file}\` to \`${renamed}\``);
		}
	}
	if (!found) logger.warn("No tsup config found");
	return found;
}
function renameKey(obj, oldKey, newKey, newValue) {
	const newObj = {};
	for (const key of Object.keys(obj)) if (key === oldKey) newObj[newKey] = newValue || obj[oldKey];
	else newObj[key] = obj[key];
	return newObj;
}

//#endregion
export { migrate };