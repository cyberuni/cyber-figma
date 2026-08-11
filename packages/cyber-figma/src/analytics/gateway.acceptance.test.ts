import { describe } from 'vitest'
import { createAnalyticsApi } from './api.js'
import { defineAnalyticsAcceptanceSpecs } from './gateway.acceptance.js'
import { createFigmaAnalyticsGateway } from './gateway.js'
import { createAnalyticsPagingClient } from './paging-double.js'

// No network: the same specs the system suite runs against Figma, run here
// against the row_cursor double.
describe(
	'library analytics',
	defineAnalyticsAcceptanceSpecs({
		fileKey: 'lib123',
		api: createAnalyticsApi(
			createFigmaAnalyticsGateway(
				createAnalyticsPagingClient([[{ week: '2026-01-05' }], [{ week: '2026-01-12' }], [{ week: '2026-01-19' }]]),
			),
		),
	}),
)
