import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineDomain } from './composition.js'
import { renderHomeView } from './default-command.js'

const MANAGED = ['FIGMA_ACCESS_TOKEN', 'FIGMA_TOKEN', 'FIGMA_TEAM_ID', 'FIGMA_TEAM'] as const
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
	vi.restoreAllMocks()
})

const domains = [
	defineDomain({ name: 'file', createApi: () => ({}), command: () => ({}) as never, registerTools: () => {} }),
	defineDomain({ name: 'comment', createApi: () => ({}), command: () => ({}) as never, registerTools: () => {} }),
]

// AXI principles 8 and 10: running with no arguments shows live state and
// identifies the tool, rather than printing a manual.
describe('renderHomeView', () => {
	it('identifies the binary and what it does', () => {
		const view = renderHomeView({ domains, bin: '/home/someone/.local/bin/cyber-figma', home: '/home/someone' })
		expect(view.bin).toBe('~/.local/bin/cyber-figma')
		expect(view.description).toMatch(/Figma/)
	})

	it('reports the credential as missing when there is none, and how to set it', () => {
		const view = renderHomeView({ domains })
		expect(view.auth.configured).toBe(false)
		expect(view.next_steps.join(' ')).toContain('FIGMA_ACCESS_TOKEN')
	})

	// The token itself must never reach stdout; only whether one is configured.
	it('never prints the token', () => {
		process.env.FIGMA_ACCESS_TOKEN = 'secret-token'
		const view = renderHomeView({ domains })
		expect(view.auth.configured).toBe(true)
		expect(JSON.stringify(view)).not.toContain('secret-token')
	})

	it('reports the auth mode so plan-token limitations are visible up front', () => {
		process.env.FIGMA_ACCESS_TOKEN = 'secret-token'
		expect(renderHomeView({ domains }).auth.mode).toBe('personal')
	})

	it('reports the configured team, and says it is unset when it is not', () => {
		expect(renderHomeView({ domains }).team).toBeNull()
		process.env.FIGMA_TEAM_ID = '1234'
		expect(renderHomeView({ domains }).team).toBe('1234')
	})

	it('lists the resources this build actually ships', () => {
		expect(renderHomeView({ domains }).resources).toEqual(['file', 'comment'])
	})

	// A build with no domains wired in must say so rather than print a blank
	// list that reads like a broken install.
	it('names the empty state when no domains are wired in', () => {
		const view = renderHomeView({ domains: [] })
		expect(view.resources).toEqual([])
		expect(view.next_steps.join(' ')).toMatch(/no resource commands/i)
	})

	it('suggests setting a team once a credential exists', () => {
		process.env.FIGMA_ACCESS_TOKEN = 'secret-token'
		expect(renderHomeView({ domains }).next_steps.join(' ')).toContain('FIGMA_TEAM_ID')
	})
})
