import { describe, expect, it } from 'vitest'
import { paginationOptions, paginationParams } from './mcp-options.js'

// An MCP tool advertises its parameters as a schema, so a parameter the
// endpoint does not have is worse than on the CLI: the client sees it in the
// tool listing and will confidently send it.
describe('paginationParams', () => {
	it('offers nothing for an endpoint that returns everything at once', () => {
		expect(Object.keys(paginationParams({ model: 'none', itemsKey: 'comments' }))).toEqual([])
	})

	it('offers cursor walking for a cursor-only model', () => {
		expect(Object.keys(paginationParams({ model: 'row_cursor', itemsKey: 'rows' })).sort()).toEqual([
			'cursor',
			'fetch_all',
			'max_pages',
		])
	})

	it('offers a page size for a model that accepts a limit', () => {
		expect(Object.keys(paginationParams({ model: 'next_cursor', itemsKey: 'rows' }))).toContain('page_size')
	})

	it('offers before and after for the page-bounded models', () => {
		const keys = Object.keys(paginationParams({ model: 'id_cursor', itemsKey: 'components' }))
		expect(keys).toContain('before')
		expect(keys).toContain('after')
		expect(keys).not.toContain('cursor')
	})

	it('produces schemas that validate and reject', () => {
		const params = paginationParams({ model: 'next_cursor', itemsKey: 'rows', maxPageSize: 1000 })
		expect(params.page_size?.safeParse(500).success).toBe(true)
		expect(params.page_size?.safeParse(0).success).toBe(false)
		expect(params.page_size?.safeParse(1.5).success).toBe(false)
		expect(params.page_size?.safeParse(5000).success).toBe(false)
	})

	it('describes each parameter so the tool listing is self-explanatory', () => {
		const params = paginationParams({ model: 'row_cursor', itemsKey: 'rows' })
		expect(params.cursor?.description).toBeTruthy()
	})
})

describe('paginationOptions', () => {
	it('renames the snake_case tool params onto the one options shape', () => {
		expect(paginationOptions({ page_size: 50, cursor: 'c1', fetch_all: true, max_pages: 3 })).toEqual({
			pageSize: 50,
			cursor: 'c1',
			before: undefined,
			after: undefined,
			fetchAll: true,
			maxPages: 3,
		})
	})
})
