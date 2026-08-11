import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { envValue } from './env.js'

const MANAGED = ['FIGMA_ACCESS_TOKEN', 'FIGMA_TOKEN', 'FIGMA_TEAM_ID', 'FIGMA_TEAM'] as const

describe('envValue', () => {
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

	it('reads the canonical token variable', () => {
		process.env.FIGMA_ACCESS_TOKEN = 'real-token'
		expect(envValue('FIGMA_ACCESS_TOKEN')).toBe('real-token')
	})

	it('falls back to the FIGMA_TOKEN alias', () => {
		process.env.FIGMA_TOKEN = 'alias-token'
		expect(envValue('FIGMA_ACCESS_TOKEN')).toBe('alias-token')
	})

	it('prefers FIGMA_ACCESS_TOKEN over the FIGMA_TOKEN alias', () => {
		process.env.FIGMA_TOKEN = 'alias-token'
		process.env.FIGMA_ACCESS_TOKEN = 'canonical-token'
		expect(envValue('FIGMA_ACCESS_TOKEN')).toBe('canonical-token')
	})

	it('reads the canonical team variable and its alias', () => {
		process.env.FIGMA_TEAM = 'alias-team'
		expect(envValue('FIGMA_TEAM_ID')).toBe('alias-team')
		process.env.FIGMA_TEAM_ID = 'canonical-team'
		expect(envValue('FIGMA_TEAM_ID')).toBe('canonical-team')
	})

	it('reads a variable that has no alias list', () => {
		process.env.FIGMA_FILE_KEY = 'abc123'
		expect(envValue('FIGMA_FILE_KEY')).toBe('abc123')
		delete process.env.FIGMA_FILE_KEY
	})

	it('treats an empty value as absent', () => {
		process.env.FIGMA_ACCESS_TOKEN = ''
		expect(envValue('FIGMA_ACCESS_TOKEN')).toBeUndefined()
	})

	// An agent host that cannot expand a ${VAR} reference forwards the reference
	// text verbatim, so the server receives the placeholder as its value.
	it('treats an unexpanded placeholder as absent', () => {
		// biome-ignore lint/suspicious/noTemplateCurlyInString: the literal placeholder text is the input under test
		process.env.FIGMA_ACCESS_TOKEN = '${FIGMA_ACCESS_TOKEN}'
		expect(envValue('FIGMA_ACCESS_TOKEN')).toBeUndefined()
	})

	it('treats an unexpanded placeholder carrying a default as absent', () => {
		// biome-ignore lint/suspicious/noTemplateCurlyInString: the literal placeholder text is the input under test
		process.env.FIGMA_ACCESS_TOKEN = '${FIGMA_ACCESS_TOKEN:-}'
		expect(envValue('FIGMA_ACCESS_TOKEN')).toBeUndefined()
	})

	it('falls through to the alias when the canonical variable is a placeholder', () => {
		// biome-ignore lint/suspicious/noTemplateCurlyInString: the literal placeholder text is the input under test
		process.env.FIGMA_ACCESS_TOKEN = '${FIGMA_ACCESS_TOKEN}'
		process.env.FIGMA_TOKEN = 'real-token'
		expect(envValue('FIGMA_ACCESS_TOKEN')).toBe('real-token')
	})

	it('keeps a value that merely contains placeholder-like text', () => {
		// biome-ignore lint/suspicious/noTemplateCurlyInString: the literal placeholder text is the input under test
		const embedded = 'prefix-${NOT_A_PLACEHOLDER}-suffix'
		process.env.FIGMA_ACCESS_TOKEN = embedded
		expect(envValue('FIGMA_ACCESS_TOKEN')).toBe(embedded)
	})
})
