import { describe } from 'vitest'
import type { FigmaClient } from '../client.js'
import { createPaymentApi } from './api.js'
import { definePaymentAcceptanceSpecs } from './gateway.acceptance.js'
import { createFigmaPaymentGateway } from './gateway.js'

// No network: the same specs the system suite runs against Figma. The double
// answers with the payload the client hands back once the `{status, error,
// meta}` envelope has been unwrapped.
const client: FigmaClient = {
	authMode: 'personal',
	request: async () =>
		({
			user_id: 'u1',
			resource_id: 'p1',
			resource_type: 'PLUGIN',
			payment_status: { type: 'PAID' },
		}) as never,
}

describe(
	'payments',
	definePaymentAcceptanceSpecs({
		api: createPaymentApi(createFigmaPaymentGateway(client)),
		userId: 'u1',
		pluginId: 'p1',
	}),
)
