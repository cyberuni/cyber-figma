import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { optionalTeamId, requireTeamId, setRepoConfigTeamId, setTeamOverride } from './scope.js'

const MANAGED = ['FIGMA_TEAM_ID', 'FIGMA_TEAM'] as const
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
	setTeamOverride(undefined)
	setRepoConfigTeamId(undefined)
})

// Figma states plainly that a team id cannot be obtained programmatically from
// a token, so every team-scoped command needs one supplied and needs to say
// where it comes from when it is missing.
describe('team id resolution', () => {
	it('prefers a team id given to the command', () => {
		process.env.FIGMA_TEAM_ID = 'env'
		setTeamOverride('global-flag')
		expect(requireTeamId('command-arg')).toBe('command-arg')
	})

	it('falls back to the --team global flag', () => {
		process.env.FIGMA_TEAM_ID = 'env'
		setTeamOverride('global-flag')
		expect(requireTeamId()).toBe('global-flag')
	})

	it('falls back to FIGMA_TEAM_ID', () => {
		process.env.FIGMA_TEAM_ID = 'env'
		expect(requireTeamId()).toBe('env')
	})

	it('accepts a team URL anywhere a team id is accepted', () => {
		expect(requireTeamId('https://www.figma.com/files/team/1234/Design')).toBe('1234')
		setTeamOverride('https://www.figma.com/files/team/5678/Design')
		expect(requireTeamId()).toBe('5678')
	})

	it('ignores an unexpanded placeholder in the environment', () => {
		// biome-ignore lint/suspicious/noTemplateCurlyInString: the literal placeholder text is the input under test
		process.env.FIGMA_TEAM_ID = '${FIGMA_TEAM_ID}'
		expect(optionalTeamId()).toBeUndefined()
	})

	it('reports no team id rather than throwing when one is optional', () => {
		expect(optionalTeamId()).toBeUndefined()
	})

	it('explains where a team id comes from when there is none', () => {
		expect(() => requireTeamId()).toThrowError(/FIGMA_TEAM_ID/)
		expect(() => requireTeamId()).toThrowError(/--team/)
		// The URL bar is the only place a user can get this.
		expect(() => requireTeamId()).toThrowError(/\/team\//)
	})
})

// The repo config is the last resort: it makes a checked-out repo
// self-describing without forcing every contributor to set an env var, but a
// contributor who does set one is deliberately overriding the repo.
describe('the repo config as a team id source', () => {
	it('supplies a team id when nothing else does', () => {
		setRepoConfigTeamId('repo-team')
		expect(requireTeamId()).toBe('repo-team')
	})

	it('loses to FIGMA_TEAM_ID', () => {
		setRepoConfigTeamId('repo-team')
		process.env.FIGMA_TEAM_ID = 'env-team'
		expect(requireTeamId()).toBe('env-team')
	})

	it('loses to the --team flag', () => {
		setRepoConfigTeamId('repo-team')
		setTeamOverride('flag-team')
		expect(requireTeamId()).toBe('flag-team')
	})
})
