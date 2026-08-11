import { describe, expect, it } from 'vitest'
import { createRecordingClient } from '../testing/paginating-gateway.js'
import { createFigmaVariableGateway } from './gateway.js'

const LOCAL_META = { variables: {}, variableCollections: {} }

describe('local variables', () => {
	it('asks Figma for the local variables of a file', async () => {
		const client = createRecordingClient([LOCAL_META])

		await createFigmaVariableGateway(client).local('abc123')

		expect(client.requests[0]).toMatchObject({
			method: 'GET',
			path: '/v1/files/abc123/variables/local',
			unwrap: 'meta',
		})
	})

	it('escapes a file key that is not URL safe', async () => {
		const client = createRecordingClient([LOCAL_META])

		await createFigmaVariableGateway(client).local('a b/c')

		expect(client.requests[0]?.path).toBe('/v1/files/a%20b%2Fc/variables/local')
	})

	it('returns the meta payload the client unwrapped', async () => {
		const meta = { variables: { 'VariableID:1:2': { id: 'VariableID:1:2' } }, variableCollections: {} }
		const client = createRecordingClient([meta])

		expect(await createFigmaVariableGateway(client).local('abc123')).toBe(meta)
	})
})

describe('published variables', () => {
	it('asks Figma for the published variables of a file', async () => {
		const client = createRecordingClient([LOCAL_META])

		await createFigmaVariableGateway(client).published('abc123')

		expect(client.requests[0]).toMatchObject({
			method: 'GET',
			path: '/v1/files/abc123/variables/published',
			unwrap: 'meta',
		})
	})
})

describe('variable changes', () => {
	it('posts the change set to the file', async () => {
		const client = createRecordingClient([{ tempIdToRealId: {} }])
		const changes = {
			variables: [
				{ action: 'CREATE' as const, name: 'brand', variableCollectionId: 'c', resolvedType: 'COLOR' as const },
			],
		}

		await createFigmaVariableGateway(client).apply('abc123', changes)

		expect(client.requests[0]).toMatchObject({
			method: 'POST',
			path: '/v1/files/abc123/variables',
			body: changes,
			unwrap: 'meta',
		})
	})

	it('returns the temporary id mapping', async () => {
		const client = createRecordingClient([{ tempIdToRealId: { tmp: 'VariableID:1:2' } }])

		const result = await createFigmaVariableGateway(client).apply('abc123', {})

		expect(result.tempIdToRealId).toEqual({ tmp: 'VariableID:1:2' })
	})
})
