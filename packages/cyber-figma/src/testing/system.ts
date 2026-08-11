import { envValue } from '../env.js'

// System suites reuse the same acceptance factories the unit suites run against
// doubles, but against the live API. They skip themselves when unconfigured —
// a contributor without a Figma token must not see a red build.

export function isSystemTestEnabled(): boolean {
	return Boolean(process.env.FIGMA_SYSTEM_TEST && envValue('FIGMA_ACCESS_TOKEN'))
}

/** An optional system-test variable, read through the alias and placeholder rules. */
export function systemEnv(name: string): string | undefined {
	return envValue(name)
}

export function requireSystemEnv(name: string): string {
	const value = systemEnv(name)
	if (!value) throw new Error(`Missing ${name} for system test`)
	return value
}
