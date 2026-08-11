import { describe } from 'vitest'
import { createAiUsageApi } from './api.js'
import { defineAiUsageAcceptanceSpecs } from './gateway.acceptance.js'
import { createFigmaAiUsageGateway } from './gateway.js'
import { createAiUsagePagingClient } from './paging-double.js'

// No network: the same specs the system suite runs against Figma, run against
// the next_cursor double.
describe(
	'ai usage',
	defineAiUsageAcceptanceSpecs({
		startDate: '2026-01-01',
		endDate: '2026-01-31',
		api: createAiUsageApi(
			createFigmaAiUsageGateway(
				createAiUsagePagingClient([[{ day: '2026-01-01' }], [{ day: '2026-01-02' }], [{ day: '2026-01-03' }]]),
			),
		),
	}),
)
