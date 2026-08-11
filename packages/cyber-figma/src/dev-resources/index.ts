import { defineDomain } from '../composition.js'
import { createDevResourceApi } from './api.js'
import { devResourceCommand } from './cli.js'
import { createFigmaDevResourceGateway } from './gateway.js'
import { registerDevResourceTools } from './mcp.js'

export const devResourceDomain = defineDomain({
	name: 'dev-resource',
	createApi: (client) => createDevResourceApi(createFigmaDevResourceGateway(client)),
	command: devResourceCommand,
	registerTools: registerDevResourceTools,
})
