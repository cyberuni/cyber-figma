import { describe, expect, it } from 'vitest'
import { createRecordingClient } from '../testing/paginating-gateway.js'
import {
	createFigmaLibraryGateway,
	type LibraryFamily,
	libraryFileListPagination,
	libraryTeamListPagination,
} from './gateway.js'

const FAMILIES: LibraryFamily[] = ['components', 'component_sets', 'styles']

describe('libraryTeamListPagination', () => {
	it('declares the integer id-cursor model the team endpoints actually use', () => {
		expect(libraryTeamListPagination('components')).toEqual({
			model: 'id_cursor',
			itemsKey: 'components',
			defaultPageSize: 30,
			maxPageSize: 1000,
		})
	})

	it('names the family as the items key, because that is where Figma puts them', () => {
		expect(libraryTeamListPagination('component_sets').itemsKey).toBe('component_sets')
		expect(libraryTeamListPagination('styles').itemsKey).toBe('styles')
	})
})

describe('libraryFileListPagination', () => {
	it('declares no pagination, because the file-scoped endpoints return everything at once', () => {
		expect(libraryFileListPagination('styles')).toEqual({ model: 'none', itemsKey: 'styles' })
	})
})

describe('createFigmaLibraryGateway', () => {
	describe('listByTeam', () => {
		it.each(FAMILIES)('asks Figma for the team %s', async (family) => {
			const client = createRecordingClient([{ status: 200, error: false, meta: { [family]: [] } }])

			await createFigmaLibraryGateway(client, family).listByTeam('1234')

			expect(client.requests[0]).toMatchObject({ method: 'GET', path: `/v1/teams/1234/${family}` })
		})

		it('sends the documented default page size when the caller asked for none', async () => {
			const client = createRecordingClient([{ status: 200, error: false, meta: { components: [] } }])

			await createFigmaLibraryGateway(client, 'components').listByTeam('1234')

			expect(client.requests[0].query).toEqual({ page_size: 30 })
		})

		it('caps a page size above the documented maximum rather than letting Figma reject it', async () => {
			const client = createRecordingClient([{ status: 200, error: false, meta: { components: [] } }])

			await createFigmaLibraryGateway(client, 'components').listByTeam('1234', { pageSize: 5000 })

			expect(client.requests[0].query).toMatchObject({ page_size: 1000 })
		})

		it('passes the opaque integer cursor through as after', async () => {
			const client = createRecordingClient([{ status: 200, error: false, meta: { components: [] } }])

			await createFigmaLibraryGateway(client, 'components').listByTeam('1234', { after: '42' })

			expect(client.requests[0].query).toMatchObject({ after: '42' })
		})

		it('escapes a team id rather than pasting it into the path', async () => {
			const client = createRecordingClient([{ status: 200, error: false, meta: { styles: [] } }])

			await createFigmaLibraryGateway(client, 'styles').listByTeam('a/b')

			expect(client.requests[0].path).toBe('/v1/teams/a%2Fb/styles')
		})

		it('returns the published items in the uniform paginated shape', async () => {
			const client = createRecordingClient([
				{ status: 200, error: false, meta: { components: [{ key: 'k1' }], cursor: { after: 7 } } },
			])

			const result = await createFigmaLibraryGateway(client, 'components').listByTeam('1234')

			expect(result.data).toEqual([{ key: 'k1' }])
			expect(result.count).toBe(1)
			expect(result.next_cursor).toBe('7')
			expect(result.pagination_model).toBe('id_cursor')
		})
	})

	describe('listByFile', () => {
		it.each(FAMILIES)('asks Figma for the published %s of a file', async (family) => {
			const client = createRecordingClient([{ status: 200, error: false, meta: { [family]: [] } }])

			await createFigmaLibraryGateway(client, family).listByFile('abc123')

			expect(client.requests[0]).toMatchObject({ method: 'GET', path: `/v1/files/abc123/${family}` })
		})

		it('sends no pagination parameters, because the endpoint has none', async () => {
			const client = createRecordingClient([{ status: 200, error: false, meta: { components: [] } }])

			await createFigmaLibraryGateway(client, 'components').listByFile('abc123', { pageSize: 10 })

			expect(client.requests[0].query).toEqual({})
		})

		it('reads the items out of the meta envelope', async () => {
			const client = createRecordingClient([{ status: 200, error: false, meta: { styles: [{ key: 's1' }] } }])

			const result = await createFigmaLibraryGateway(client, 'styles').listByFile('abc123')

			expect(result.data).toEqual([{ key: 's1' }])
			expect(result.pagination_model).toBe('none')
			expect(result.next_cursor).toBeNull()
		})
	})

	describe('get', () => {
		it.each([
			['components', '/v1/components/key-1'],
			['component_sets', '/v1/component_sets/key-1'],
			['styles', '/v1/styles/key-1'],
		] as const)('asks Figma for a single published %s by key', async (family, path) => {
			const client = createRecordingClient([{ status: 200, error: false, meta: { key: 'key-1' } }])

			await createFigmaLibraryGateway(client, family).get('key-1')

			expect(client.requests[0]).toMatchObject({ method: 'GET', path })
		})

		// The endpoint wraps its payload in `{status, error, meta}`, so the request
		// declares it and the client hands back the item itself.
		it('declares the meta envelope so the client unwraps it', async () => {
			const client = createRecordingClient([{ key: 'key-1', name: 'Button' }])

			const item = await createFigmaLibraryGateway(client, 'components').get('key-1')

			expect(item).toEqual({ key: 'key-1', name: 'Button' })
			expect(client.requests[0].unwrap).toBe('meta')
		})

		it('escapes a key rather than pasting it into the path', async () => {
			const client = createRecordingClient([{ status: 200, error: false, meta: { key: 'a/b' } }])

			await createFigmaLibraryGateway(client, 'styles').get('a/b')

			expect(client.requests[0].path).toBe('/v1/styles/a%2Fb')
		})
	})
})
