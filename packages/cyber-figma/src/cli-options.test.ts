import { Command } from 'commander'
import { describe, expect, it } from 'vitest'
import { addPaginationOptions, paginationOptionsFromCli, parsePageSize } from './cli-options.js'
import type { PaginationSpec } from './pagination.js'

function flagsFor(spec: PaginationSpec) {
	const command = addPaginationOptions(new Command('list'), spec)
	return command.options.map((option) => option.long)
}

// Which pagination flags a command offers is decided by the model underneath.
// Offering --cursor on an endpoint that has no cursor would be a lie an agent
// would then act on.
describe('addPaginationOptions', () => {
	it('adds no pagination flags to an endpoint that returns everything at once', () => {
		expect(flagsFor({ model: 'none', itemsKey: 'comments' })).toEqual([])
	})

	it('adds only cursor walking for a cursor-only model', () => {
		expect(flagsFor({ model: 'row_cursor', itemsKey: 'rows' })).toEqual(['--cursor', '--all', '--max-pages'])
	})

	it('adds a page size for a model that accepts a limit', () => {
		expect(flagsFor({ model: 'next_cursor', itemsKey: 'rows' })).toContain('--page-size')
	})

	it('adds the before and after bounds for the page-bounded models', () => {
		const flags = flagsFor({ model: 'id_cursor', itemsKey: 'components' })
		expect(flags).toContain('--before')
		expect(flags).toContain('--after')
		expect(flags).not.toContain('--cursor')
	})

	it('documents the endpoint-specific default page size in the help text', () => {
		const command = addPaginationOptions(new Command('list'), {
			model: 'id_cursor',
			itemsKey: 'components',
			defaultPageSize: 30,
			maxPageSize: 1000,
		})
		const pageSize = command.options.find((option) => option.long === '--page-size')
		expect(pageSize?.description).toContain('30')
		expect(pageSize?.description).toContain('1000')
	})
})

describe('parsePageSize', () => {
	it('accepts a positive integer', () => {
		expect(parsePageSize('30')).toBe(30)
	})

	it('rejects zero, negatives, and non-integers', () => {
		for (const bad of ['0', '-1', '1.5', 'abc']) {
			expect(() => parsePageSize(bad)).toThrowError(/positive integer/)
		}
	})
})

describe('paginationOptionsFromCli', () => {
	it('renames the cli spellings onto the one options shape', () => {
		expect(paginationOptionsFromCli({ pageSize: 50, cursor: 'c1', all: true, maxPages: 3 })).toEqual({
			pageSize: 50,
			cursor: 'c1',
			before: undefined,
			after: undefined,
			fetchAll: true,
			maxPages: 3,
		})
	})

	// collectPages starts its walk at the cursor it is given, so --all --cursor
	// means "every remaining page from here" — a real capability, not a mistake.
	it('allows resuming a full walk from a saved cursor', () => {
		expect(paginationOptionsFromCli({ all: true, cursor: 'c1' })).toMatchObject({ fetchAll: true, cursor: 'c1' })
	})

	it('rejects before and after together', () => {
		expect(() => paginationOptionsFromCli({ before: '1', after: '2' })).toThrowError(/mutually exclusive/)
	})
})
