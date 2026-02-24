import { defineConfig } from "tsdown";

export default defineConfig({
  dts: true,
  format: ["esm"],
  entry: ["./src/index.ts", "./src/client.ts"],
  outDir: "dist",
  clean: true,
  treeshake: true,
  external: ["better-auth", "better-call"],
});
