import { describe, expect, it } from 'vitest'
import { createRecordingClient } from '../testing/paginating-gateway.js'
import { createFileApi, IMAGE_FILL_URL_EXPIRY_DAYS, RENDER_URL_EXPIRY_DAYS } from './api.js'
import { createFigmaFileGateway } from './gateway.js'

function apiWith(responses: unknown[]) {
	const client = createRecordingClient(responses)
	return { api: createFileApi(createFigmaFileGateway(client)), client }
}

const FILE = { name: 'Design', version: '1', document: { id: '0:0', children: [] } }

describe('get', () => {
	it('accepts a pasted file URL wherever a file key is taken', async () => {
		const { api, client } = apiWith([FILE])
		await api.get('https://www.figma.com/design/abc123/My-File?node-id=1-2')

		expect(client.requests[0]?.path).toBe('/v1/files/abc123')
	})

	// GET file is tier 1, and a View or Collab seat gets roughly six tier-1 calls
	// a month. An unbounded default would spend one on the entire document tree.
	it('asks for pages only when the caller narrowed nothing', async () => {
		const { api, client } = apiWith([FILE])
		await api.get('abc123')

		expect(client.requests[0]?.query?.depth).toBe(1)
	})

	it('does not impose a depth when the caller already narrowed to specific nodes', async () => {
		const { api, client } = apiWith([FILE])
		await api.get('abc123', { ids: '1-2,3-4' })

		expect(client.requests[0]?.query?.depth).toBeUndefined()
		expect(client.requests[0]?.query?.ids).toEqual(['1:2', '3:4'])
	})

	it('sends no depth at all when the caller explicitly asks for the whole tree', async () => {
		const { api, client } = apiWith([FILE])
		await api.get('abc123', { depth: 'all' })

		expect(client.requests[0]?.query?.depth).toBeUndefined()
	})

	it('sends the depth the caller chose', async () => {
		const { api, client } = apiWith([FILE])
		await api.get('abc123', { depth: 3 })

		expect(client.requests[0]?.query?.depth).toBe(3)
	})
})

describe('nodes', () => {
	it('translates the dashed node ids of a URL into the colons the API takes', async () => {
		const { api, client } = apiWith([{ nodes: {} }])
		await api.nodes('abc123', '1-2, 3-4')

		expect(client.requests[0]?.query?.ids).toEqual(['1:2', '3:4'])
	})

	it('refuses to call a tier-1 endpoint with no node ids to narrow it', async () => {
		const { api } = apiWith([{ nodes: {} }])

		await expect(api.nodes('abc123', '')).rejects.toThrowError(/node id/i)
	})
})

describe('images', () => {
	it('renders every id in a single call, which is how Figma says to avoid rate limits', async () => {
		const { api, client } = apiWith([{ err: null, images: { '1:2': 'https://a', '3:4': 'https://b' } }])
		await api.images('abc123', '1-2,3-4')

		expect(client.requests).toHaveLength(1)
	})

	it('reports a null url as a node that did not render, not as a failed call', async () => {
		const { api } = apiWith([{ err: null, images: { '1:2': 'https://a', '3:4': null } }])
		const result = await api.images('abc123', '1-2,3-4')

		expect(result.images).toEqual([
			{ node_id: '1:2', url: 'https://a', rendered: true },
			{ node_id: '3:4', url: null, rendered: false },
		])
		expect(result.rendered_count).toBe(1)
		expect(result.failed_count).toBe(1)
		expect(result.failed_node_ids).toEqual(['3:4'])
	})

	it('states how long the rendered urls last, because they expire', async () => {
		const { api } = apiWith([{ err: null, images: { '1:2': 'https://a' } }])

		expect((await api.images('abc123', '1-2')).url_expires_after_days).toBe(RENDER_URL_EXPIRY_DAYS)
	})

	it('refuses an empty id list rather than rendering the whole file', async () => {
		const { api } = apiWith([{ err: null, images: {} }])

		await expect(api.images('abc123', '')).rejects.toThrowError(/node id/i)
	})

	it('rejects a scale outside the documented range before spending the call', async () => {
		const { api } = apiWith([{ err: null, images: {} }])

		await expect(api.images('abc123', '1-2', { scale: 8 })).rejects.toThrowError(/0\.01/)
	})
})

describe('imageFills', () => {
	it('turns the imageRef map into rows and names the shorter expiry these urls have', async () => {
		const { api } = apiWith([{ images: { 'ref-1': 'https://a' } }])
		const result = await api.imageFills('abc123')

		expect(result.images).toEqual([{ image_ref: 'ref-1', url: 'https://a' }])
		expect(result.count).toBe(1)
		expect(result.url_expires_after_days).toBe(IMAGE_FILL_URL_EXPIRY_DAYS)
	})

	it('reports a file with no image fills as empty rather than failing', async () => {
		const { api } = apiWith([{ images: {} }])

		expect(await api.imageFills('abc123')).toMatchObject({ images: [], count: 0 })
	})
})

describe('meta', () => {
	it('returns the file metadata itself rather than its wrapper', async () => {
		const { api } = apiWith([{ file: { name: 'Design', last_touched_at: '2026-08-01T00:00:00Z' } }])

		expect(await api.meta('abc123')).toMatchObject({ name: 'Design' })
	})
})

describe('versions', () => {
	it('returns the uniform paginated result', async () => {
		const { api } = apiWith([{ versions: [{ id: '1' }], pagination: {} }])

		expect(await api.versions('abc123')).toMatchObject({ count: 1, pagination_model: 'url_page' })
	})
})
