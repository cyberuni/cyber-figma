import { describe, expect, it } from 'vitest'
import { createRecordingClient } from '../testing/paginating-gateway.js'
import { createVariableApi } from './api.js'
import { createFigmaVariableGateway } from './gateway.js'

const LOCAL = {
	variables: {
		'VariableID:1:2': { id: 'VariableID:1:2', name: 'brand/primary', variableCollectionId: 'VariableCollectionId:1:1' },
		'VariableID:1:3': { id: 'VariableID:1:3', name: 'space/gap', variableCollectionId: 'VariableCollectionId:2:1' },
	},
	variableCollections: {
		'VariableCollectionId:1:1': { id: 'VariableCollectionId:1:1', name: 'Brand' },
		'VariableCollectionId:2:1': { id: 'VariableCollectionId:2:1', name: 'Layout' },
	},
}

const PUBLISHED = {
	variables: { 'VariableID:1:2': { id: 'VariableID:1:2', subscribed_id: 'VariableID:sub', name: 'brand/primary' } },
	variableCollections: { 'VariableCollectionId:1:1': { id: 'VariableCollectionId:1:1', subscribed_id: 'sub' } },
}

function apiWith(responses: unknown[]) {
	const client = createRecordingClient(responses)
	return { api: createVariableApi(createFigmaVariableGateway(client)), client }
}

describe('list', () => {
	it('turns the id-keyed map Figma returns into a list', async () => {
		const { api } = apiWith([LOCAL])

		const result = await api.list('abc123')

		expect(result.data.map((variable) => variable.id)).toEqual(['VariableID:1:2', 'VariableID:1:3'])
		expect(result.count).toBe(2)
	})

	it('accepts a Figma file URL wherever a file key is taken', async () => {
		const { api, client } = apiWith([LOCAL])

		await api.list('https://www.figma.com/design/abc123/Design-System?node-id=1-2')

		expect(client.requests[0]?.path).toBe('/v1/files/abc123/variables/local')
	})

	it('reads the published endpoint when asked for published variables', async () => {
		const { api, client } = apiWith([PUBLISHED])

		const result = await api.list('abc123', { published: true })

		expect(client.requests[0]?.path).toBe('/v1/files/abc123/variables/published')
		expect(result.data[0]).toHaveProperty('subscribed_id')
	})

	it('filters to one collection when asked', async () => {
		const { api } = apiWith([LOCAL])

		const result = await api.list('abc123', { collectionId: 'VariableCollectionId:2:1' })

		expect(result.data.map((variable) => variable.id)).toEqual(['VariableID:1:3'])
	})

	it('reports an empty file as an empty list rather than failing', async () => {
		const { api } = apiWith([{ variables: {}, variableCollections: {} }])

		expect((await api.list('abc123')).data).toEqual([])
	})
})

describe('collections', () => {
	it('lists the local collections', async () => {
		const { api } = apiWith([LOCAL])

		expect((await api.collections('abc123')).data.map((collection) => collection.name)).toEqual(['Brand', 'Layout'])
	})

	it('lists the published collections when asked', async () => {
		const { api, client } = apiWith([PUBLISHED])

		await api.collections('abc123', { published: true })

		expect(client.requests[0]?.path).toBe('/v1/files/abc123/variables/published')
	})
})

describe('get', () => {
	it('resolves the variable id a node carries in boundVariables', async () => {
		const { api } = apiWith([LOCAL])

		expect((await api.get('abc123', 'VariableID:1:2')).name).toBe('brand/primary')
	})

	it('names the file and the id when the variable is not in it', async () => {
		const { api } = apiWith([LOCAL])

		await expect(api.get('abc123', 'VariableID:9:9')).rejects.toThrow(/VariableID:9:9.*abc123/s)
	})
})

describe('apply', () => {
	it('validates the change set before spending a request', async () => {
		const { api, client } = apiWith([])

		await expect(api.apply('abc123', { variables: [{ action: 'UPDATE' }] })).rejects.toThrow(/variables\[0\]/)
		expect(client.requests).toEqual([])
	})

	it('posts a valid change set and returns the temporary id mapping', async () => {
		const { api, client } = apiWith([{ tempIdToRealId: { tmp_var: 'VariableID:1:2' } }])

		const result = await api.apply('abc123', {
			variables: [{ action: 'CREATE', id: 'tmp_var', name: 'gap', variableCollectionId: 'c', resolvedType: 'FLOAT' }],
		})

		expect(client.requests[0]).toMatchObject({ method: 'POST', path: '/v1/files/abc123/variables' })
		expect(result.temp_id_to_real_id).toEqual({ tmp_var: 'VariableID:1:2' })
	})

	it('reports what the change set touched, so an acknowledgement is not an empty ok', async () => {
		const { api } = apiWith([{ tempIdToRealId: {} }])

		const result = await api.apply('abc123', {
			variableCollections: [{ action: 'CREATE', name: 'Brand' }],
			variableModeValues: [{ variableId: 'v', modeId: 'm', value: 1 }],
		})

		expect(result.changes).toEqual({ variableCollections: 1, variableModeValues: 1 })
	})

	it('checks a change set without sending it, for a callers who cannot reach the endpoint', async () => {
		const { api, client } = apiWith([])

		const result = api.validate({ variableCollections: [{ action: 'CREATE', name: 'Brand' }] })

		expect(result).toEqual({
			valid: true,
			changes: { variableCollections: 1 },
			note: expect.stringMatching(/publish/i),
		})
		expect(client.requests).toEqual([])
	})

	it('reports an invalid change set from the check the same way as from the send', () => {
		const { api } = apiWith([])

		expect(() => api.validate({ variables: [{ action: 'UPDATE' }] })).toThrow(/variables\[0\]/)
	})

	it('warns that a change is invisible to other files until the library is published', async () => {
		const { api } = apiWith([{ tempIdToRealId: {} }])

		const result = await api.apply('abc123', { variableCollections: [{ action: 'CREATE', name: 'Brand' }] })

		expect(result.note).toMatch(/publish/i)
	})
})
