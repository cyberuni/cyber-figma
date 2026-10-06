import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	output,
	printCountSummary,
	printEmpty,
	printNextSteps,
	printSummary,
	printTable,
	selectFormat,
} from './output.js'
import { encodeToon } from './toon.js'

describe('selectFormat', () => {
	it('returns text by default', () => {
		expect(selectFormat(['node', 'cli', 'task', 'list'])).toBe('text')
	})

	it('returns json when --json is present', () => {
		expect(selectFormat(['node', 'cli', '--json'])).toBe('json')
	})

	it('returns toon when --toon is present', () => {
		expect(selectFormat(['node', 'cli', '--toon'])).toBe('toon')
	})

	it('prefers toon when both --toon and --json are present', () => {
		expect(selectFormat(['node', 'cli', '--json', '--toon'])).toBe('toon')
	})
})

describe('output', () => {
	afterEach(() => vi.restoreAllMocks())

	it('prints TOON when the toon format is selected', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
		output({ a: 1 }, () => {}, ['node', 'cli', '--toon'])
		expect(spy).toHaveBeenCalledWith(encodeToon({ a: 1 }))
	})

	it('prints pretty JSON when the json format is selected', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
		output({ a: 1 }, () => {}, ['node', 'cli', '--json'])
		expect(spy).toHaveBeenCalledWith(JSON.stringify({ a: 1 }, null, 2))
	})

	it('invokes the readable renderer when the text format is selected', () => {
		const readable = vi.fn()
		output({ a: 1 }, readable, ['node', 'cli'])
		expect(readable).toHaveBeenCalledOnce()
	})
})

describe('printTable', () => {
	afterEach(() => vi.restoreAllMocks())

	it('prints a definitive empty state when there are no rows', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
		printTable([], [{ label: 'Name', get: () => '' }])
		expect(spy).toHaveBeenCalledWith('0 results')
	})

	it('keeps a multi-line value on its own row', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
		printTable([{ m: 'first line\ncc @someone\r\n  third' }], [{ label: 'message', get: (r) => r.m }])
		const rows = spy.mock.calls.map(([line]) => String(line))
		expect(rows).toEqual(['MESSAGE'.padEnd(28), '-'.repeat(28), 'first line cc @someone third'])
	})

	it('caps a column at its max width so one long value cannot stretch the table', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
		printTable(
			[{ id: '1', m: 'x'.repeat(600) }],
			[
				{ label: 'id', get: (r) => r.id },
				{ label: 'message', get: (r) => r.m, max: 10 },
			],
		)
		const rows = spy.mock.calls.map(([line]) => String(line))
		expect(rows[2]).toBe(`1   ${'x'.repeat(9)}…`)
		expect(rows.at(-1)).toBe('\nLong values are cut to fit the table; use --full to see them whole.')
	})

	it('prints capped values whole with full', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
		printTable([{ m: 'x'.repeat(20) }], [{ label: 'message', get: (r) => r.m, max: 10 }], { full: true })
		const rows = spy.mock.calls.map(([line]) => String(line))
		expect(rows).toEqual(['MESSAGE'.padEnd(20), '-'.repeat(20), 'x'.repeat(20)])
	})

	it('says nothing about truncation when every value fits', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
		printTable([{ m: 'short' }], [{ label: 'message', get: (r) => r.m, max: 10 }])
		expect(spy).toHaveBeenCalledTimes(3)
	})
})

describe('printNextSteps', () => {
	afterEach(() => vi.restoreAllMocks())

	it('prints suggestions in text mode', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
		printNextSteps(['cyber-figma task get <gid>'], ['node', 'cli'])
		expect(spy).toHaveBeenCalledWith('\nNext steps:')
		expect(spy).toHaveBeenCalledWith('  - cyber-figma task get <gid>')
	})

	it('stays silent in structured modes to keep output parseable', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
		printNextSteps(['do a thing'], ['node', 'cli', '--toon'])
		printNextSteps(['do a thing'], ['node', 'cli', '--json'])
		expect(spy).not.toHaveBeenCalled()
	})

	it('prints nothing when there are no suggestions', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
		printNextSteps([], ['node', 'cli'])
		expect(spy).not.toHaveBeenCalled()
	})
})

describe('printSummary', () => {
	afterEach(() => vi.restoreAllMocks())

	it('prints the aggregate line in text mode', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
		printSummary('3 tasks: 2 incomplete, 1 done', ['node', 'cli'])
		expect(spy).toHaveBeenCalledWith('3 tasks: 2 incomplete, 1 done')
	})

	it('stays silent in structured modes', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
		printSummary('3 tasks', ['node', 'cli', '--json'])
		expect(spy).not.toHaveBeenCalled()
	})
})

describe('printEmpty', () => {
	afterEach(() => vi.restoreAllMocks())

	it('prints a definitive zero-results line', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
		printEmpty()
		expect(spy).toHaveBeenCalledWith('0 results')
	})

	it('includes the entity name when provided', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
		printEmpty('tasks')
		expect(spy).toHaveBeenCalledWith('0 tasks found')
	})
})

describe('printCountSummary', () => {
	afterEach(() => vi.restoreAllMocks())

	it('prints a count line in text mode', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
		printCountSummary(3, 'project(s)', ['node', 'cli'])
		expect(spy).toHaveBeenCalledWith('\n3 project(s)')
	})

	it('stays silent in structured modes', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
		printCountSummary(3, 'project(s)', ['node', 'cli', '--json'])
		printCountSummary(3, 'project(s)', ['node', 'cli', '--toon'])
		expect(spy).not.toHaveBeenCalled()
	})

	it('says nothing for an empty result — the empty state already did', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
		printCountSummary(0, 'project(s)', ['node', 'cli'])
		expect(spy).not.toHaveBeenCalled()
	})
})

describe('printEmpty', () => {
	afterEach(() => vi.restoreAllMocks())

	it('names the entity when one is given', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
		printEmpty('projects')
		expect(spy).toHaveBeenCalledWith('0 projects found')
	})

	it('falls back to a bare count when no entity is given', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
		printEmpty()
		expect(spy).toHaveBeenCalledWith('0 results')
	})

	it('printTable forwards its entity name to the empty state', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
		printTable([], [{ label: 'Name', get: () => '' }], { entity: 'tasks' })
		expect(spy).toHaveBeenCalledWith('0 tasks found')
	})
})
