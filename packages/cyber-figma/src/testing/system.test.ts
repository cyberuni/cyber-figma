import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isSystemTestEnabled, requireSystemEnv, systemEnv } from './system.js'

const MANAGED = ['FIGMA_SYSTEM_TEST', 'FIGMA_ACCESS_TOKEN', 'FIGMA_TOKEN', 'FIGMA_TEAM_ID', 'FIGMA_TEAM'] as const
const original = Object.fromEntries(MANAGED.map((name) => [name, process.env[name]]))

beforeEach(() => {
	for (const name of MANAGED) delete process.env[name]
})

afterEach(() => {
	for (const name of MANAGED) {
		const value = original[name]
		if (value !== undefined) process.env[name] = value
		else delete process.env[name]
	}
})

// A system suite must skip itself rather than fail when it has no credential —
// otherwise every contributor without a Figma token sees a red build.
describe('isSystemTestEnabled', () => {
	it('is off by default', () => {
		expect(isSystemTestEnabled()).toBe(false)
	})

	it('stays off when the opt-in is set but no credential is', () => {
		process.env.FIGMA_SYSTEM_TEST = '1'
		expect(isSystemTestEnabled()).toBe(false)
	})

	it('stays off when a credential is set but the opt-in is not', () => {
		process.env.FIGMA_ACCESS_TOKEN = 'pat'
		expect(isSystemTestEnabled()).toBe(false)
	})

	it('is on when both the opt-in and a credential are set', () => {
		process.env.FIGMA_SYSTEM_TEST = '1'
		process.env.FIGMA_ACCESS_TOKEN = 'pat'
		expect(isSystemTestEnabled()).toBe(true)
	})

	it('does not count an unexpanded placeholder as a credential', () => {
		process.env.FIGMA_SYSTEM_TEST = '1'
		// biome-ignore lint/suspicious/noTemplateCurlyInString: the literal placeholder text is the input under test
		process.env.FIGMA_ACCESS_TOKEN = '${FIGMA_ACCESS_TOKEN}'
		expect(isSystemTestEnabled()).toBe(false)
	})
})

describe('systemEnv', () => {
	it('reads an optional variable through the same alias and placeholder rules', () => {
		process.env.FIGMA_TEAM = 'alias-team'
		expect(systemEnv('FIGMA_TEAM_ID')).toBe('alias-team')
	})

	it('reports an unset optional variable as undefined', () => {
		expect(systemEnv('FIGMA_TEAM_ID')).toBeUndefined()
	})

	it('names the missing variable when a suite requires one', () => {
		expect(() => requireSystemEnv('FIGMA_TEAM_ID')).toThrowError(/FIGMA_TEAM_ID/)
	})

	it('returns a required variable that is set', () => {
		process.env.FIGMA_TEAM_ID = '1234'
		expect(requireSystemEnv('FIGMA_TEAM_ID')).toBe('1234')
	})
})
