import { describe } from 'vitest'
import type { FigmaClient } from '../client.js'
import { createActivityLogApi } from './api.js'
import { defineActivityLogAcceptanceSpecs } from './gateway.acceptance.js'
import { createFigmaActivityLogGateway } from './gateway.js'

// No network: the same specs the system suite runs against Figma. The double
// answers every call, because the acceptance factory asks more than once.
const client: FigmaClient = {
	authMode: 'plan',
	request: async () =>
		({
			status: 200,
			error: false,
			meta: {
				activity_logs: [{ id: 'e1', timestamp: 1_700_000_000 }],
				cursor: 'c1',
				next_page: false,
			},
		}) as never,
}

describe(
	'activity logs',
	defineActivityLogAcceptanceSpecs({ api: createActivityLogApi(createFigmaActivityLogGateway(client)) }),
)
