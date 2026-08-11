import { Command } from 'commander'
import { describe, expect, it } from 'vitest'
import { exitCodeFor, renderCliError } from './cli-error.js'
import { FigmaApiError } from './figma-error.js'

function apiError(status: number, init: { path?: string; detail?: string; headers?: Record<string, string> } = {}) {
	return new FigmaApiError({ status, method: 'GET', path: '/v1/files/abc', ...init })
}

function usageError() {
	const command = new Command('list')
	command.option('--limit <n>', 'Results per page')
	return Object.assign(new Error("error: unknown option '--limt'"), {
		code: 'commander.unknownOption',
		command,
	})
}

// Meaningful, stable exit codes — AXI principle 6. Agents branch on these
// without parsing the message, so the mapping is part of the contract.
describe('exitCodeFor', () => {
	it('maps a generic failure to 1', () => {
		expect(exitCodeFor(new Error('nope'))).toBe(1)
	})

	it('maps a usage mistake to 2, which the caller can fix and retry', () => {
		expect(exitCodeFor(usageError())).toBe(2)
	})

	it('maps a missing credential to 3', () => {
		expect(exitCodeFor(new Error('FIGMA_ACCESS_TOKEN environment variable is not set.'))).toBe(3)
	})

	it('maps 401 to 3', () => {
		expect(exitCodeFor(apiError(401))).toBe(3)
	})

	it('maps 403 to 4', () => {
		expect(exitCodeFor(apiError(403))).toBe(4)
	})

	it('maps 404 to 5', () => {
		expect(exitCodeFor(apiError(404))).toBe(5)
	})

	it('maps 429 to 6', () => {
		expect(exitCodeFor(apiError(429))).toBe(6)
	})

	// A plan gate is a billing fact, not a permission mistake, and retrying will
	// never help — so it gets its own code rather than sharing 403's.
	it('maps an Enterprise-gated refusal to 7, not to 4', () => {
		expect(exitCodeFor(apiError(403, { path: '/v1/files/abc/variables/local' }))).toBe(7)
	})

	it('maps a 500 to 1', () => {
		expect(exitCodeFor(apiError(500))).toBe(1)
	})
})

describe('renderCliError in text mode', () => {
	it('renders a Figma API failure as a single human line', () => {
		expect(renderCliError(apiError(404, { detail: 'Not found' }), 'text')).toContain('Figma API error: Not found')
	})

	it('renders a generic failure with an Error prefix', () => {
		expect(renderCliError(new Error('nope'), 'text')).toBe('Error: nope')
	})

	it('adds the hint on its own line when there is one', () => {
		const text = renderCliError(apiError(403), 'text')
		expect(text).toContain('Hint:')
		expect(text).toMatch(/expire/i)
	})

	it('names the plan requirement for a gated endpoint', () => {
		expect(renderCliError(apiError(403, { path: '/v1/activity_logs' }), 'text')).toContain('Enterprise')
	})

	it('lists the valid flags for a usage mistake so it self-corrects in one turn', () => {
		const text = renderCliError(usageError(), 'text')
		expect(text).toContain("unknown option '--limt'")
		expect(text).toContain('--limit <n>')
	})
})

describe('renderCliError in structured modes', () => {
	it('renders JSON an agent can branch on', () => {
		const parsed = JSON.parse(renderCliError(apiError(429, { headers: { 'retry-after': '42' } }), 'json'))
		expect(parsed.ok).toBe(false)
		expect(parsed.error.reason).toBe('rate_limited')
		expect(parsed.error.retry_after_seconds).toBe(42)
	})

	it('renders TOON', () => {
		const toon = renderCliError(new Error('nope'), 'toon')
		expect(toon).toContain('ok: false')
		expect(toon).toContain('message: nope')
	})

	it('renders a usage mistake structurally too', () => {
		const parsed = JSON.parse(renderCliError(usageError(), 'json'))
		expect(parsed.error.kind).toBe('usage')
		expect(parsed.error.valid_flags).toContain('--limit <n>')
	})
})
