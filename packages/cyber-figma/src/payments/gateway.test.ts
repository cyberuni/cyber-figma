import { describe, expect, it } from 'vitest'
import type { FigmaClient } from '../client.js'
import { FigmaApiError } from '../figma-error.js'
import { createRecordingClient } from '../testing/paginating-gateway.js'
import { createFigmaPaymentGateway } from './gateway.js'

// The payload the client hands back once the `{status, error, meta}` envelope
// this endpoint uses has been unwrapped.
const PAYMENT = { user_id: 'u1', resource_id: 'p1', resource_type: 'PLUGIN', payment_status: { type: 'PAID' } }

function forbidden(): FigmaApiError {
	return new FigmaApiError({ status: 403, method: 'GET', path: '/v1/payments' })
}

describe('payment gateway', () => {
	it('asks Figma for a user’s payment state on one resource', async () => {
		const client = createRecordingClient([PAYMENT])
		await createFigmaPaymentGateway(client).get({ userId: 'u1', pluginId: 'p1' })

		expect(client.requests[0]).toMatchObject({
			method: 'GET',
			path: '/v1/payments',
			query: { user_id: 'u1', plugin_id: 'p1' },
			unwrap: 'meta',
		})
	})

	it('sends a plugin payment token on its own when that is the mode', async () => {
		const client = createRecordingClient([PAYMENT])
		await createFigmaPaymentGateway(client).get({ pluginPaymentToken: 'ppt_abc' })

		expect(client.requests[0].query).toEqual({ plugin_payment_token: 'ppt_abc' })
	})

	it('names the community file or widget when that is the resource', async () => {
		const client = createRecordingClient([PAYMENT])
		await createFigmaPaymentGateway(client).get({ userId: 'u1', widgetId: 'w1' })

		expect(client.requests[0].query).toMatchObject({ widget_id: 'w1' })
	})

	it('returns the payment information itself, not the envelope', async () => {
		const client = createRecordingClient([PAYMENT])

		await expect(createFigmaPaymentGateway(client).get({ userId: 'u1', pluginId: 'p1' })).resolves.toEqual(PAYMENT)
	})

	// Payments is the one endpoint with no OAuth support at all and no plan-token
	// support either, and Figma answers the wrong credential with an ordinary 403.
	it('explains that only a personal access token works when a bearer token is refused', async () => {
		const client: FigmaClient = {
			authMode: 'oauth',
			request: async () => {
				throw forbidden()
			},
		}

		await expect(createFigmaPaymentGateway(client).get({ userId: 'u1', pluginId: 'p1' })).rejects.toMatchObject({
			hint: expect.stringContaining('personal access token'),
		})
	})

	it('leaves a refusal on a personal access token to the spine to explain', async () => {
		const client: FigmaClient = {
			authMode: 'personal',
			request: async () => {
				throw forbidden()
			},
		}

		await expect(createFigmaPaymentGateway(client).get({ userId: 'u1', pluginId: 'p1' })).rejects.not.toHaveProperty(
			'hint',
		)
	})
})
