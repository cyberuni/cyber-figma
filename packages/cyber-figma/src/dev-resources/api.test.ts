import { describe, expect, it } from 'vitest'
import { FigmaApiError } from '../figma-error.js'
import { createRecordingClient } from '../testing/paginating-gateway.js'
import { createDevResourceApi } from './api.js'
import { createFigmaDevResourceGateway } from './gateway.js'

function apiWith(...responses: unknown[]) {
	const client = createRecordingClient(responses)
	return { client, api: createDevResourceApi(createFigmaDevResourceGateway(client)) }
}

const LINK = { id: 'dr-1', name: 'PR', url: 'https://example.com/pr/1', file_key: 'abc123', node_id: '1:2' }

describe('list', () => {
	it('takes the file key out of a pasted Figma URL', async () => {
		const { client, api } = apiWith({ dev_resources: [LINK] })

		const result = await api.list('https://www.figma.com/design/abc123/My-File?node-id=1-2')

		expect(client.requests[0].path).toBe('/v1/files/abc123/dev_resources')
		expect(result.data).toEqual([LINK])
	})

	// The URL bar spells node ids with a dash; the API only accepts the colon form.
	it('normalizes URL-form node ids to the API form', async () => {
		const { client, api } = apiWith({ dev_resources: [] })

		await api.list('abc123', { nodeIds: '1-2, 3-4' })

		expect(client.requests[0].query).toEqual({ node_ids: ['1:2', '3:4'] })
	})
})

describe('create', () => {
	it('reports every requested link as created when Figma rejected none', async () => {
		const { api } = apiWith({ links_created: [LINK] })

		const result = await api.create([{ file: 'abc123', nodeId: '1-2', name: 'PR', url: 'https://example.com/pr/1' }])

		expect(result).toMatchObject({
			ok: true,
			action: 'create',
			requested: 1,
			succeeded: 1,
			failed: 0,
			dev_resources: [LINK],
			errors: [],
		})
	})

	// The trap: HTTP 200 with an `errors` array. A 2xx is not proof of success.
	it('reports a 200 that carries errors as a partial success, not a success', async () => {
		const { api } = apiWith({
			links_created: [LINK],
			errors: [{ file_key: 'abc123', node_id: '9:9', error: 'Node already has 10 dev resources' }],
		})

		const result = await api.create([
			{ file: 'abc123', nodeId: '1-2', name: 'PR', url: 'https://example.com/pr/1' },
			{ file: 'abc123', nodeId: '9-9', name: 'PR', url: 'https://example.com/pr/1' },
		])

		expect(result).toMatchObject({
			ok: false,
			requested: 2,
			succeeded: 1,
			failed: 1,
			errors: [{ file_key: 'abc123', node_id: '9:9', error: 'Node already has 10 dev resources' }],
		})
	})

	it('fails outright when every requested link was rejected', async () => {
		const { api } = apiWith({
			links_created: [],
			errors: [{ file_key: 'nope', node_id: '1:2', error: 'File not found' }],
		})

		await expect(
			api.create([{ file: 'nope', nodeId: '1-2', name: 'PR', url: 'https://example.com/pr/1' }]),
		).rejects.toThrow(/File not found/)
	})
})

describe('update', () => {
	it('sends only the fields the caller is changing', async () => {
		const { client, api } = apiWith({ links_updated: [LINK] })

		await api.update([{ id: 'dr-1', name: 'Renamed' }])

		expect(client.requests[0].body).toEqual({ dev_resources: [{ id: 'dr-1', name: 'Renamed' }] })
	})

	it('reports a 200 that carries errors as a partial success, not a success', async () => {
		const { api } = apiWith({ links_updated: [LINK], errors: [{ id: 'dr-2', error: 'Dev resource not found' }] })

		const result = await api.update([{ id: 'dr-1', name: 'Renamed' }, { id: 'dr-2' }])

		expect(result).toMatchObject({
			ok: false,
			action: 'update',
			requested: 2,
			succeeded: 1,
			failed: 1,
			errors: [{ id: 'dr-2', error: 'Dev resource not found' }],
		})
	})

	it('fails outright when every change was rejected', async () => {
		const { api } = apiWith({ errors: [{ id: 'dr-2', error: 'Dev resource not found' }] })

		await expect(api.update([{ id: 'dr-2', name: 'Renamed' }])).rejects.toThrow(/Dev resource not found/)
	})
})

describe('remove', () => {
	it('reports a deleted dev resource', async () => {
		const { api } = apiWith(undefined)

		expect(await api.remove('abc123', 'dr-1')).toMatchObject({
			deleted: true,
			resource: 'dev resource',
			id: 'dr-1',
			already_absent: false,
		})
	})

	// AXI principle 6: deleting what is already gone is the state the caller asked for.
	it('succeeds when the dev resource is already gone', async () => {
		const { api } = apiWith(
			new FigmaApiError({ status: 404, method: 'DELETE', path: '/v1/files/abc123/dev_resources/dr-1' }),
		)

		expect(await api.remove('abc123', 'dr-1')).toMatchObject({ deleted: true, already_absent: true })
	})
})
