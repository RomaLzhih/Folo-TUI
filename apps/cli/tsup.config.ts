import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts", "src/folo-tui.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: false,
  dts: false,
  splitting: false,
  shims: false,
  esbuildOptions(options) {
    options.jsx = "automatic"
  },
  banner: {
    js: "#!/usr/bin/env node",
  },
})
