import { defineDomain } from '../composition.js'
import { createActivityLogApi } from './api.js'
import { activityLogCommand } from './cli.js'
import { createFigmaActivityLogGateway } from './gateway.js'
import { registerActivityLogTools } from './mcp.js'

export const activityLogDomain = defineDomain({
	name: 'activity-log',
	createApi: (client) => createActivityLogApi(createFigmaActivityLogGateway(client)),
	command: activityLogCommand,
	registerTools: registerActivityLogTools,
})
