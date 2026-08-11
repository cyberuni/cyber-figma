import { defineConfig } from 'vitest/config'

// System suites run the same acceptance specs the unit suites run against
// doubles, but against the live Figma API. They are gated on FIGMA_SYSTEM_TEST
// plus a credential and skip themselves when those are unset.
export default defineConfig({
	test: {
		include: ['src/**/*.system.ts'],
		testTimeout: 30_000,
		// A build with no system suites yet — the spine, or a domain that has not
		// written one — must pass rather than report "no test files found" as a
		// failure of the command.
		passWithNoTests: true,
	},
})
