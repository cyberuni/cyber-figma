import { describe } from 'vitest'
import type { FigmaClient } from '../client.js'
import { createDiscoveryApi } from './api.js'
import { defineDiscoveryAcceptanceSpecs } from './gateway.acceptance.js'
import { createFigmaDiscoveryGateway } from './gateway.js'

// No network: the same specs the system suite runs against Figma. The double
// answers every call with the payload the client would hand back once the
// `{status, error, meta}` envelope has been unwrapped.
const client: FigmaClient = {
	authMode: 'oauth',
	request: async () =>
		({
			urls: { '2026/01/01/00': ['https://s3.example/a.json'], '2026/01/01/01': ['https://s3.example/b.json'] },
		}) as never,
}

describe(
	'discovery',
	defineDiscoveryAcceptanceSpecs({
		api: createDiscoveryApi(createFigmaDiscoveryGateway(client)),
		startDate: '2026-01-01T00:00:00Z',
		endDate: '2026-01-01T02:00:00Z',
	}),
)
