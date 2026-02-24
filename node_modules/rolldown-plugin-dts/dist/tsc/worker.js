import { tscEmit } from "../tsc-DkRb5DrU.js";
import { createBirpc } from "birpc";
import process from "node:process";

//#region src/tsc/worker.ts
const functions = { tscEmit };
createBirpc(functions, {
	post: (data) => process.send(data),
	on: (fn) => process.on("message", fn)
});

//#endregion