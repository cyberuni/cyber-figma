import { describe, expect, it } from 'vitest'
import { createRecordingClient } from '../testing/paginating-gateway.js'
import { createPaymentApi } from './api.js'
import { createFigmaPaymentGateway } from './gateway.js'

const PAYMENT = { user_id: 'u1', resource_id: 'p1', resource_type: 'PLUGIN', payment_status: { type: 'PAID' } }

function apiWith() {
	const client = createRecordingClient([PAYMENT])
	return { api: createPaymentApi(createFigmaPaymentGateway(client)), client }
}

describe('payment api', () => {
	it('returns the payment information for a user and one resource', async () => {
		const { api } = apiWith()

		await expect(api.get({ userId: 'u1', pluginId: 'p1' })).resolves.toEqual(PAYMENT)
	})

	it('accepts a plugin payment token on its own', async () => {
		const { api } = apiWith()

		await expect(api.get({ pluginPaymentToken: 'ppt_abc' })).resolves.toEqual(PAYMENT)
	})

	it('rejects a call with neither a plugin payment token nor a user id', async () => {
		const { api, client } = apiWith()

		await expect(api.get({ pluginId: 'p1' })).rejects.toThrowError(/user_id|plugin_payment_token/)
		expect(client.requests).toHaveLength(0)
	})

	it('rejects a user id with no resource to ask about', async () => {
		const { api } = apiWith()

		await expect(api.get({ userId: 'u1' })).rejects.toThrowError(/community_file_id.*plugin_id.*widget_id/)
	})

	it('rejects two resource ids, because Figma takes exactly one', async () => {
		const { api } = apiWith()

		await expect(api.get({ userId: 'u1', pluginId: 'p1', widgetId: 'w1' })).rejects.toThrowError(/exactly one/)
	})

	it('says that only resources you own can be queried, since that is the usual refusal', async () => {
		const { api } = apiWith()

		await expect(api.get({ userId: 'u1' })).rejects.toThrowError(/own/)
	})
})
