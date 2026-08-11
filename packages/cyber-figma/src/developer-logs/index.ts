import { defineDomain } from '../composition.js'
import { createDeveloperLogApi } from './api.js'
import { developerLogCommand } from './cli.js'
import { createFigmaDeveloperLogGateway } from './gateway.js'
import { registerDeveloperLogTools } from './mcp.js'

export const developerLogDomain = defineDomain({
	name: 'developer-log',
	createApi: (client) => createDeveloperLogApi(createFigmaDeveloperLogGateway(client)),
	command: developerLogCommand,
	registerTools: registerDeveloperLogTools,
})
