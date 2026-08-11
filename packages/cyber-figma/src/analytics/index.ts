import { defineDomain } from '../composition.js'
import { createAnalyticsApi } from './api.js'
import { analyticsCommand } from './cli.js'
import { createFigmaAnalyticsGateway } from './gateway.js'
import { registerAnalyticsTools } from './mcp.js'

export const analyticsDomain = defineDomain({
	name: 'analytics',
	createApi: (client) => createAnalyticsApi(createFigmaAnalyticsGateway(client)),
	command: analyticsCommand,
	registerTools: registerAnalyticsTools,
})
