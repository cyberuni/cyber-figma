import { defineConfig } from 'vitest/config'

// System suites run the same acceptance specs the unit suites run against
// doubles, but against the live Figma API. They are gated on FIGMA_SYSTEM_TEST
// plus a credential and skip themselves when those are unset.
export default defineConfig({
	test: {
		include: ['src/**/*.system.ts'],
		testTimeout: 30_000,
	},
})
