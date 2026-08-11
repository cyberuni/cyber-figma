import { defineConfig } from 'tsdown'

// `cli` and `mcp` entries join this list once those surfaces land; the CLI `bin`
// and the `./mcp` export in package.json follow the same step.
export default defineConfig({
	entry: {
		index: 'src/index.ts',
	},
	format: 'esm',
	outExtensions: () => ({
		js: '.js',
	}),
	dts: true,
	clean: true,
	outDir: 'dist',
	platform: 'node',
	target: 'node22',
})
