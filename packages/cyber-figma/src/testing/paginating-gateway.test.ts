import { describe, expect, it } from 'vitest'
import { collectPages, type PaginationSpec } from '../pagination.js'
import { createPaginatingClient, createRecordingClient, figmaPageBody } from './paginating-gateway.js'

// The doubles a domain pod writes its acceptance specs against. They emit the
// real wire shape of each pagination model, so a gateway exercised against them
// is exercised against what Figma actually sends.
describe('figmaPageBody', () => {
	it('emits the meta envelope and integer cursor of the team-library model', () => {
		const spec: PaginationSpec = { model: 'id_cursor', itemsKey: 'components' }
		expect(figmaPageBody(spec, [['a'], ['b']], {})).toEqual({
			status: 200,
			error: false,
			meta: { components: ['a'], cursor: { after: 1 } },
		})
	})

	it('emits the row envelope and boolean flag of the analytics model', () => {
		const spec: PaginationSpec = { model: 'row_cursor', itemsKey: 'rows' }
		expect(figmaPageBody(spec, [['a'], ['b']], {})).toEqual({ rows: ['a'], next_page: true, cursor: '1' })
	})

	it('omits the analytics cursor on the last page, as Figma does', () => {
		const spec: PaginationSpec = { model: 'row_cursor', itemsKey: 'rows' }
		expect(figmaPageBody(spec, [['a']], {})).toEqual({ rows: ['a'], next_page: false })
	})

	it('emits full next_page URLs for the url models', () => {
		const spec: PaginationSpec = { model: 'url_page', itemsKey: 'versions' }
		const body = figmaPageBody(spec, [['v1'], ['v2']], {}) as { pagination: { next_page: string } }
		expect(body.pagination.next_page).toMatch(/^https:\/\/api\.figma\.com\/.*after=1$/)
	})

	it('emits everything at once for an unpaginated endpoint', () => {
		const spec: PaginationSpec = { model: 'none', itemsKey: 'comments' }
		expect(figmaPageBody(spec, [['a'], ['b']], {})).toEqual({ comments: ['a', 'b'] })
	})
})

describe('createPaginatingClient', () => {
	it('walks every model end to end through the real collectPages', async () => {
		const models: PaginationSpec[] = [
			{ model: 'url_cursor', itemsKey: 'reactions' },
			{ model: 'url_page', itemsKey: 'versions' },
			{ model: 'id_cursor', itemsKey: 'components' },
			{ model: 'row_cursor', itemsKey: 'rows' },
			{ model: 'next_cursor', itemsKey: 'rows' },
			{ model: 'meta_cursor', itemsKey: 'items' },
		]

		for (const spec of models) {
			const client = createPaginatingClient(spec, [['a'], ['b'], ['c']])
			const result = await collectPages(spec, (opts) => client.request({ method: 'GET', path: '/v1/x' }, opts), {
				fetchAll: true,
			})

			expect(result.data, spec.model).toEqual(['a', 'b', 'c'])
			expect(result.page_count, spec.model).toBe(3)
			expect(result.truncated, spec.model).toBe(false)
		}
	})

	it('returns one page when the caller does not walk', async () => {
		const spec: PaginationSpec = { model: 'row_cursor', itemsKey: 'rows' }
		const client = createPaginatingClient(spec, [['a'], ['b']])
		const result = await collectPages(spec, (opts) => client.request({ method: 'GET', path: '/v1/x' }, opts))

		expect(result.data).toEqual(['a'])
		expect(result.next_cursor).toBe('1')
	})
})

describe('createRecordingClient', () => {
	it('returns the queued response and records what was requested', async () => {
		const client = createRecordingClient([{ name: 'Design' }])

		await expect(client.request({ method: 'GET', path: '/v1/files/abc', query: { depth: 2 } })).resolves.toEqual({
			name: 'Design',
		})
		expect(client.requests).toEqual([{ method: 'GET', path: '/v1/files/abc', query: { depth: 2 } }])
	})

	it('throws whatever was queued as an error, so error paths are testable', async () => {
		const boom = new Error('boom')
		const client = createRecordingClient([boom])
		await expect(client.request({ method: 'GET', path: '/v1/files/abc' })).rejects.toThrowError(boom)
	})

	it('fails loudly rather than silently returning undefined when it runs out', async () => {
		const client = createRecordingClient([])
		await expect(client.request({ method: 'GET', path: '/v1/files/abc' })).rejects.toThrowError(/no queued response/i)
	})
})
