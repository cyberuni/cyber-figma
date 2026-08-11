import { defineDomain } from '../composition.js'
import { createDiscoveryApi } from './api.js'
import { discoveryCommand } from './cli.js'
import { createFigmaDiscoveryGateway } from './gateway.js'
import { registerDiscoveryTools } from './mcp.js'

export const discoveryDomain = defineDomain({
	name: 'discovery',
	createApi: (client) => createDiscoveryApi(createFigmaDiscoveryGateway(client)),
	command: discoveryCommand,
	registerTools: registerDiscoveryTools,
})
