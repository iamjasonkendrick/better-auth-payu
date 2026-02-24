import { bgRed, bgYellow, blue, green, rgb, yellow } from "ansis";

//#region src/utils/general.ts
function toArray(val, defaultValue) {
	if (Array.isArray(val)) return val;
	else if (val == null) {
		if (defaultValue) return [defaultValue];
		return [];
	} else return [val];
}
function resolveComma(arr) {
	return arr.flatMap((format) => format.split(","));
}
function resolveRegex(str) {
	if (str.length > 2 && str[0] === "/" && str.at(-1) === "/") return new RegExp(str.slice(1, -1));
	return str;
}
function debounce(fn, wait) {
	let timeout;
	return function(...args) {
		if (timeout) clearTimeout(timeout);
		timeout = setTimeout(() => {
			timeout = void 0;
			fn.apply(this, args);
		}, wait);
	};
}
function slash(string) {
	return string.replaceAll("\\", "/");
}
const noop = (v) => v;

//#endregion
//#region src/utils/logger.ts
var Logger = class {
	silent = false;
	setSilent(value) {
		this.silent = value;
	}
	filter(...args) {
		return args.filter((arg) => arg !== void 0 && arg !== false);
	}
	info(...args) {
		if (!this.silent) console.info(blue`ℹ`, ...this.filter(...args));
	}
	warn(...args) {
		if (!this.silent) console.warn("\n", bgYellow` WARN `, ...this.filter(...args), "\n");
	}
	error(...args) {
		if (!this.silent) console.error("\n", bgRed` ERROR `, ...this.filter(...args), "\n");
	}
	success(...args) {
		if (!this.silent) console.info(green`✔`, ...this.filter(...args));
	}
};
const logger = new Logger();
function prettyName(name) {
	if (!name) return void 0;
	return generateColor(name)(`[${name}]`);
}
function prettyFormat(format) {
	const formatColor = format === "es" ? blue : format === "cjs" ? yellow : noop;
	let formatText;
	switch (format) {
		case "es":
			formatText = "ESM";
			break;
		default:
			formatText = format.toUpperCase();
			break;
	}
	return formatColor(`[${formatText}]`);
}
const colors = /* @__PURE__ */ new Map();
function generateColor(name = "default") {
	if (colors.has(name)) return colors.get(name);
	let color;
	if (name === "default") color = blue;
	else {
		let hash = 0;
		for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
		const hue = hash % 360;
		const saturation = 35;
		const lightness = 55;
		color = rgb(...hslToRgb(hue, saturation, lightness));
	}
	colors.set(name, color);
	return color;
}
function hslToRgb(h, s, l) {
	h = h % 360;
	h /= 360;
	s /= 100;
	l /= 100;
	let r, g, b;
	if (s === 0) r = g = b = l;
	else {
		const q = l < .5 ? l * (1 + s) : l + s - l * s;
		const p = 2 * l - q;
		r = hue2rgb(p, q, h + 1 / 3);
		g = hue2rgb(p, q, h);
		b = hue2rgb(p, q, h - 1 / 3);
	}
	return [
		Math.max(0, Math.round(r * 255)),
		Math.max(0, Math.round(g * 255)),
		Math.max(0, Math.round(b * 255))
	];
}
function hue2rgb(p, q, t) {
	if (t < 0) t += 1;
	if (t > 1) t -= 1;
	if (t < 1 / 6) return p + (q - p) * 6 * t;
	if (t < 1 / 2) return q;
	if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
	return p;
}

//#endregion
export { debounce, generateColor, logger, noop, prettyFormat, prettyName, resolveComma, resolveRegex, slash, toArray };