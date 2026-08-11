import { describe } from 'vitest'
import { createDeveloperLogApi } from './api.js'
import { defineDeveloperLogAcceptanceSpecs } from './gateway.acceptance.js'
import { createFigmaDeveloperLogGateway } from './gateway.js'
import { createDeveloperLogPagingClient } from './paging-double.js'

// No network: the same specs the system suite runs against Figma, run against
// the meta_cursor double.
describe(
	'developer logs',
	defineDeveloperLogAcceptanceSpecs({
		api: createDeveloperLogApi(
			createFigmaDeveloperLogGateway(
				createDeveloperLogPagingClient([[{ uuid: 'u1' }], [{ uuid: 'u2' }], [{ uuid: 'u3' }]]),
			),
		),
	}),
)
