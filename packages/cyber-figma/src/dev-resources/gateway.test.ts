import { describe, expect, it } from 'vitest'
import { createRecordingClient } from '../testing/paginating-gateway.js'
import { createFigmaDevResourceGateway } from './gateway.js'

describe('list', () => {
	it('asks Figma for the dev resources of a file', async () => {
		const client = createRecordingClient([{ dev_resources: [] }])

		await createFigmaDevResourceGateway(client).list('abc123')

		expect(client.requests[0]).toMatchObject({ method: 'GET', path: '/v1/files/abc123/dev_resources' })
	})

	it('narrows the read to the nodes the caller named', async () => {
		const client = createRecordingClient([{ dev_resources: [] }])

		await createFigmaDevResourceGateway(client).list('abc123', { nodeIds: ['1:2', '3:4'] })

		expect(client.requests[0].query).toEqual({ node_ids: ['1:2', '3:4'] })
	})

	it('omits node_ids entirely when no node was named, so the whole file is read', async () => {
		const client = createRecordingClient([{ dev_resources: [] }])

		await createFigmaDevResourceGateway(client).list('abc123', {})

		expect(client.requests[0].query).toEqual({ node_ids: undefined })
	})
})

describe('create', () => {
	// The create path is file-agnostic: one call can attach links across several
	// files, so the file key travels in each resource rather than in the path.
	it('posts every resource to the file-agnostic bulk endpoint', async () => {
		const client = createRecordingClient([{ links_created: [] }])
		const resources = [{ name: 'PR', url: 'https://example.com/pr/1', file_key: 'abc123', node_id: '1:2' }]

		await createFigmaDevResourceGateway(client).create({ dev_resources: resources })

		expect(client.requests[0]).toMatchObject({
			method: 'POST',
			path: '/v1/dev_resources',
			body: { dev_resources: resources },
		})
	})
})

describe('update', () => {
	it('puts every change to the file-agnostic bulk endpoint', async () => {
		const client = createRecordingClient([{ links_updated: [] }])
		const changes = [{ id: 'dr-1', name: 'Renamed' }]

		await createFigmaDevResourceGateway(client).update({ dev_resources: changes })

		expect(client.requests[0]).toMatchObject({
			method: 'PUT',
			path: '/v1/dev_resources',
			body: { dev_resources: changes },
		})
	})
})

describe('remove', () => {
	it('deletes one dev resource from its own file', async () => {
		const client = createRecordingClient([undefined])

		await createFigmaDevResourceGateway(client).remove('abc123', 'dr-1')

		expect(client.requests[0]).toMatchObject({
			method: 'DELETE',
			path: '/v1/files/abc123/dev_resources/dr-1',
		})
	})
})
