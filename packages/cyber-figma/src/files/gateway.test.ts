import { describe, expect, it } from 'vitest'
import { createRecordingClient } from '../testing/paginating-gateway.js'
import { createFigmaFileGateway } from './gateway.js'

describe('get file', () => {
	it('asks Figma for the file document', async () => {
		const client = createRecordingClient([{ name: 'Design' }])
		await createFigmaFileGateway(client).get('abc123')

		expect(client.requests[0]).toMatchObject({ method: 'GET', path: '/v1/files/abc123' })
	})

	it('escapes a file key that is not URL-safe', async () => {
		const client = createRecordingClient([{ name: 'Design' }])
		await createFigmaFileGateway(client).get('a/b c')

		expect(client.requests[0]?.path).toBe('/v1/files/a%2Fb%20c')
	})

	it('sends every documented tree parameter it is given', async () => {
		const client = createRecordingClient([{ name: 'Design' }])
		await createFigmaFileGateway(client).get('abc123', {
			version: '42',
			ids: ['1:2', '3:4'],
			depth: 2,
			geometry: 'paths',
			pluginData: 'shared',
			branchData: true,
		})

		expect(client.requests[0]?.query).toEqual({
			version: '42',
			ids: ['1:2', '3:4'],
			depth: 2,
			geometry: 'paths',
			plugin_data: 'shared',
			branch_data: true,
		})
	})
})

describe('get file nodes', () => {
	it('asks Figma for the named nodes of the file', async () => {
		const client = createRecordingClient([{ nodes: {} }])
		await createFigmaFileGateway(client).getNodes('abc123', ['1:2', '3:4'])

		expect(client.requests[0]).toMatchObject({
			method: 'GET',
			path: '/v1/files/abc123/nodes',
			query: { ids: ['1:2', '3:4'] },
		})
	})
})

describe('render images', () => {
	it('renders from the images endpoint, whose file key is in the path', async () => {
		const client = createRecordingClient([{ err: null, images: {} }])
		await createFigmaFileGateway(client).renderImages('abc123', ['1:2'])

		expect(client.requests[0]).toMatchObject({ method: 'GET', path: '/v1/images/abc123' })
	})

	it('puts every requested node id in one call, because Figma names batching as the way to avoid rate limits', async () => {
		const client = createRecordingClient([{ err: null, images: {} }])
		await createFigmaFileGateway(client).renderImages('abc123', ['1:2', '3:4', '5:6'])

		expect(client.requests).toHaveLength(1)
		expect(client.requests[0]?.query?.ids).toEqual(['1:2', '3:4', '5:6'])
	})

	it('keeps scale fractional, because it is the one query parameter that legitimately is', async () => {
		const client = createRecordingClient([{ err: null, images: {} }])
		await createFigmaFileGateway(client).renderImages('abc123', ['1:2'], { scale: 1.5 })

		expect(client.requests[0]?.query?.scale).toEqual({ __float: 1.5 })
	})

	it('sends the svg and bounds parameters it is given', async () => {
		const client = createRecordingClient([{ err: null, images: {} }])
		await createFigmaFileGateway(client).renderImages('abc123', ['1:2'], {
			format: 'svg',
			version: '42',
			svgOutlineText: false,
			svgIncludeId: true,
			svgIncludeNodeId: true,
			svgSimplifyStroke: false,
			contentsOnly: false,
			useAbsoluteBounds: true,
		})

		expect(client.requests[0]?.query).toMatchObject({
			format: 'svg',
			version: '42',
			svg_outline_text: false,
			svg_include_id: true,
			svg_include_node_id: true,
			svg_simplify_stroke: false,
			contents_only: false,
			use_absolute_bounds: true,
		})
	})
})

describe('get image fills', () => {
	// This endpoint wraps its payload in `{ status, error, meta }`; declaring the
	// unwrap is what makes the client hand back the payload itself.
	it('declares the meta envelope this endpoint wraps its payload in', async () => {
		const client = createRecordingClient([{ images: { ref: 'https://x' } }])
		const fills = await createFigmaFileGateway(client).getImageFills('abc123')

		expect(client.requests[0]).toMatchObject({ method: 'GET', path: '/v1/files/abc123/images', unwrap: 'meta' })
		expect(fills).toEqual({ images: { ref: 'https://x' } })
	})
})

describe('get file meta', () => {
	it('asks the cheap metadata endpoint rather than the whole document', async () => {
		const client = createRecordingClient([{ file: { name: 'Design' } }])
		await createFigmaFileGateway(client).getMeta('abc123')

		expect(client.requests[0]).toMatchObject({ method: 'GET', path: '/v1/files/abc123/meta' })
	})
})

describe('list file versions', () => {
	it('asks for version history with this endpoint own page size parameter', async () => {
		const client = createRecordingClient([{ versions: [], pagination: {} }])
		await createFigmaFileGateway(client).listVersions('abc123', { pageSize: 5 })

		expect(client.requests[0]).toMatchObject({
			method: 'GET',
			path: '/v1/files/abc123/versions',
			query: { page_size: 5 },
		})
	})

	it('sends the endpoint documented default page size when the caller set none', async () => {
		const client = createRecordingClient([{ versions: [], pagination: {} }])
		await createFigmaFileGateway(client).listVersions('abc123')

		expect(client.requests[0]?.query).toMatchObject({ page_size: 30 })
	})

	it('returns the uniform paginated result shape', async () => {
		const client = createRecordingClient([{ versions: [{ id: '1' }], pagination: {} }])
		const result = await createFigmaFileGateway(client).listVersions('abc123')

		expect(result).toMatchObject({ data: [{ id: '1' }], count: 1, pagination_model: 'url_page' })
	})
})
