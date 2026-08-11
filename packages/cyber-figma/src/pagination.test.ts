import { describe, expect, it } from 'vitest'
import type { PaginationOptions } from './pagination.js'
import { collectPages, paginationParamsFor, readPage } from './pagination.js'

// Figma paginates six different ways plus "not at all"; the request half of the
// normalization is turning one PaginationOptions shape into whichever params the
// endpoint underneath actually takes.
describe('paginationParamsFor', () => {
	it('sends an opaque cursor for the cursor-in, url-out model', () => {
		expect(paginationParamsFor({ model: 'url_cursor', itemsKey: 'reactions' }, { cursor: 'abc' })).toEqual({
			cursor: 'abc',
		})
	})

	it('sends page_size and a version bound for the file-versions model', () => {
		expect(paginationParamsFor({ model: 'url_page', itemsKey: 'versions' }, { pageSize: 50, before: '123' })).toEqual({
			page_size: 50,
			before: '123',
		})
	})

	it('sends page_size and an integer cursor bound for the team-library model', () => {
		expect(paginationParamsFor({ model: 'id_cursor', itemsKey: 'components' }, { after: '900' })).toEqual({
			after: '900',
		})
	})

	it('sends a bare cursor for the library-analytics model', () => {
		expect(paginationParamsFor({ model: 'row_cursor', itemsKey: 'rows' }, { cursor: 'c1' })).toEqual({ cursor: 'c1' })
	})

	it('sends cursor and limit for the AI-usage model', () => {
		expect(paginationParamsFor({ model: 'next_cursor', itemsKey: 'rows' }, { cursor: 'c1', pageSize: 500 })).toEqual({
			cursor: 'c1',
			limit: 500,
		})
	})

	it('sends cursor and limit for the developer-logs model, which takes them in the body', () => {
		expect(paginationParamsFor({ model: 'meta_cursor', itemsKey: 'items' }, { cursor: 'c1', pageSize: 10 })).toEqual({
			cursor: 'c1',
			limit: 10,
		})
	})

	it('sends nothing for an endpoint that does not paginate', () => {
		expect(paginationParamsFor({ model: 'none', itemsKey: 'comments' }, { pageSize: 50, cursor: 'x' })).toEqual({})
	})

	it('omits parameters the caller did not set rather than inventing defaults', () => {
		expect(paginationParamsFor({ model: 'url_page', itemsKey: 'versions' }, {})).toEqual({})
		expect(paginationParamsFor({ model: 'url_page', itemsKey: 'versions' })).toEqual({})
	})

	it('applies the endpoint-documented page size only when the caller asks for a default', () => {
		expect(
			paginationParamsFor({ model: 'id_cursor', itemsKey: 'components', defaultPageSize: 30 }, { applyDefaults: true }),
		).toEqual({ page_size: 30 })
	})

	it('caps a page size the endpoint documents a maximum for', () => {
		expect(
			paginationParamsFor({ model: 'id_cursor', itemsKey: 'components', maxPageSize: 1000 }, { pageSize: 5000 }),
		).toEqual({ page_size: 1000 })
	})

	// before and after are documented as mutually exclusive wherever both exist.
	it('rejects before and after together', () => {
		expect(() =>
			paginationParamsFor({ model: 'id_cursor', itemsKey: 'components' }, { before: '1', after: '2' }),
		).toThrowError(/mutually exclusive/)
	})
})

// The response half: six response shapes, one Page. `nextCursor` is always the
// value a caller passes back as `--cursor`, whatever the endpoint called it.
describe('readPage', () => {
	it('reads the url-cursor model and lifts the cursor out of the next_page URL', () => {
		const page = readPage(
			{ model: 'url_cursor', itemsKey: 'reactions' },
			{
				reactions: [{ id: 'r1' }],
				pagination: { next_page: 'https://api.figma.com/v1/files/a/comments/c/reactions?cursor=NEXT' },
			},
		)

		expect(page.items).toEqual([{ id: 'r1' }])
		expect(page.nextCursor).toBe('NEXT')
		expect(page.nextPageUrl).toBe('https://api.figma.com/v1/files/a/comments/c/reactions?cursor=NEXT')
	})

	it('reports the url-cursor model exhausted when no next_page URL comes back', () => {
		const page = readPage({ model: 'url_cursor', itemsKey: 'reactions' }, { reactions: [], pagination: {} })
		expect(page.nextCursor).toBeNull()
	})

	it('reads the url-page model and lifts the after bound out of the next_page URL', () => {
		const page = readPage(
			{ model: 'url_page', itemsKey: 'versions' },
			{
				versions: [{ id: 'v1' }],
				pagination: {
					prev_page: 'https://api.figma.com/v1/files/a/versions?before=100',
					next_page: 'https://api.figma.com/v1/files/a/versions?after=200',
				},
			},
		)

		expect(page.items).toEqual([{ id: 'v1' }])
		expect(page.nextCursor).toBe('200')
		expect(page.prevCursor).toBe('100')
	})

	it('reads the id-cursor model out of the meta envelope', () => {
		const page = readPage(
			{ model: 'id_cursor', itemsKey: 'components' },
			{
				status: 200,
				error: false,
				meta: { components: [{ key: 'k' }], cursor: { before: 10, after: 20 } },
			},
		)

		expect(page.items).toEqual([{ key: 'k' }])
		expect(page.nextCursor).toBe('20')
		expect(page.prevCursor).toBe('10')
	})

	it('reports the id-cursor model exhausted when the cursor carries no after', () => {
		const page = readPage({ model: 'id_cursor', itemsKey: 'styles' }, { meta: { styles: [], cursor: {} } })
		expect(page.nextCursor).toBeNull()
	})

	it('reads the row-cursor model, whose cursor is absent once next_page is false', () => {
		const more = readPage({ model: 'row_cursor', itemsKey: 'rows' }, { rows: [1], next_page: true, cursor: 'c2' })
		const done = readPage({ model: 'row_cursor', itemsKey: 'rows' }, { rows: [1], next_page: false })

		expect(more.nextCursor).toBe('c2')
		expect(done.nextCursor).toBeNull()
	})

	it('reads the next_cursor model, whose cursor is an empty string once exhausted', () => {
		const more = readPage(
			{ model: 'next_cursor', itemsKey: 'rows' },
			{
				rows: [1],
				next_cursor: 'c2',
				has_next_page: true,
			},
		)
		const done = readPage(
			{ model: 'next_cursor', itemsKey: 'rows' },
			{ rows: [], next_cursor: '', has_next_page: false },
		)

		expect(more.nextCursor).toBe('c2')
		expect(done.nextCursor).toBeNull()
	})

	it('reads the meta-cursor model, whose cursor is null once exhausted', () => {
		const more = readPage(
			{ model: 'meta_cursor', itemsKey: 'items' },
			{
				meta: { items: [1], cursor: 'c2', has_more: true },
			},
		)
		const done = readPage(
			{ model: 'meta_cursor', itemsKey: 'items' },
			{
				meta: { items: [1], cursor: null, has_more: false },
			},
		)

		expect(more.nextCursor).toBe('c2')
		expect(done.nextCursor).toBeNull()
	})

	it('reads an unpaginated endpoint as a single exhausted page', () => {
		const page = readPage({ model: 'none', itemsKey: 'comments' }, { comments: [{ id: 'c1' }] })
		expect(page.items).toEqual([{ id: 'c1' }])
		expect(page.nextCursor).toBeNull()
	})

	it('reads an unpaginated endpoint that wraps its items in meta', () => {
		const page = readPage({ model: 'none', itemsKey: 'components' }, { meta: { components: [{ key: 'k' }] } })
		expect(page.items).toEqual([{ key: 'k' }])
	})

	it('reads a missing items key as an empty page rather than throwing', () => {
		expect(readPage({ model: 'none', itemsKey: 'comments' }, {}).items).toEqual([])
	})
})

describe('collectPages', () => {
	const spec = { model: 'row_cursor', itemsKey: 'rows' } as const

	/** Three pages of one row each, cursor-chained. */
	function analyticsPages() {
		const byCursor: Record<string, unknown> = {
			'': { rows: ['a'], next_page: true, cursor: 'c2' },
			c2: { rows: ['b'], next_page: true, cursor: 'c3' },
			c3: { rows: ['c'], next_page: false },
		}
		const seen: (string | undefined)[] = []
		return {
			seen,
			fetchPage: async (opts: PaginationOptions) => {
				seen.push(opts.cursor)
				return byCursor[opts.cursor ?? '']
			},
		}
	}

	it('returns one page by default and reports the cursor for the next', async () => {
		const { fetchPage, seen } = analyticsPages()
		const result = await collectPages(spec, fetchPage)

		expect(result.data).toEqual(['a'])
		expect(result.next_cursor).toBe('c2')
		expect(result.pagination_model).toBe('row_cursor')
		expect(seen).toHaveLength(1)
	})

	it('walks every page when fetchAll is set', async () => {
		const { fetchPage } = analyticsPages()
		const result = await collectPages(spec, fetchPage, { fetchAll: true })

		expect(result.data).toEqual(['a', 'b', 'c'])
		expect(result.page_count).toBe(3)
		expect(result.next_cursor).toBeNull()
		expect(result.truncated).toBe(false)
	})

	it('stops at maxPages and says the result is truncated', async () => {
		const { fetchPage } = analyticsPages()
		const result = await collectPages(spec, fetchPage, { fetchAll: true, maxPages: 2 })

		expect(result.data).toEqual(['a', 'b'])
		expect(result.page_count).toBe(2)
		expect(result.truncated).toBe(true)
		expect(result.next_cursor).toBe('c3')
	})

	it('carries the cursor of each page into the request for the next one', async () => {
		const { fetchPage, seen } = analyticsPages()
		await collectPages(spec, fetchPage, { fetchAll: true })

		expect(seen).toEqual([undefined, 'c2', 'c3'])
	})

	it('reports the total it actually returned so a caller need not count', async () => {
		const { fetchPage } = analyticsPages()
		expect((await collectPages(spec, fetchPage, { fetchAll: true })).count).toBe(3)
	})

	// Asking to walk an endpoint that returns everything at once is not an error;
	// there is simply nothing to walk.
	it('makes one call for an unpaginated endpoint even with fetchAll', async () => {
		let calls = 0
		const result = await collectPages(
			{ model: 'none', itemsKey: 'comments' },
			async () => {
				calls += 1
				return { comments: [{ id: 'c1' }] }
			},
			{ fetchAll: true },
		)

		expect(calls).toBe(1)
		expect(result.data).toEqual([{ id: 'c1' }])
		expect(result.truncated).toBe(false)
		expect(result.pagination_model).toBe('none')
	})

	it('stops walking if an endpoint repeats a cursor instead of advancing', async () => {
		const result = await collectPages(spec, async () => ({ rows: ['x'], next_page: true, cursor: 'same' }), {
			fetchAll: true,
			maxPages: 50,
		})

		expect(result.page_count).toBe(2)
		expect(result.truncated).toBe(true)
	})
})

// The models disagree about which parameter carries the cursor forward: the
// team-library and file-version endpoints take `after`, not `cursor`. Walking
// them with `cursor` would silently re-request page one forever.
describe('collectPages advances each model with its own cursor parameter', () => {
	it('advances the id-cursor model with after', async () => {
		const sent: Record<string, unknown>[] = []
		const pages: Record<string, unknown> = {
			'': { meta: { components: ['a'], cursor: { after: 20 } } },
			'20': { meta: { components: ['b'], cursor: {} } },
		}
		const result = await collectPages(
			{ model: 'id_cursor', itemsKey: 'components' },
			async (opts) => {
				sent.push(paginationParamsFor({ model: 'id_cursor', itemsKey: 'components' }, opts))
				return pages[opts.after ?? '']
			},
			{ fetchAll: true },
		)

		expect(result.data).toEqual(['a', 'b'])
		expect(sent[1]).toEqual({ after: '20' })
	})

	it('advances the url-page model with after', async () => {
		const pages: Record<string, unknown> = {
			'': { versions: ['v1'], pagination: { next_page: 'https://api.figma.com/x?after=200' } },
			'200': { versions: ['v2'], pagination: {} },
		}
		const result = await collectPages(
			{ model: 'url_page', itemsKey: 'versions' },
			async (opts) => pages[opts.after ?? ''],
			{ fetchAll: true },
		)

		expect(result.data).toEqual(['v1', 'v2'])
	})
})
