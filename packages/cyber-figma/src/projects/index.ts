import { defineDomain } from '../composition.js'
import { createProjectApi } from './api.js'
import { projectCommand } from './cli.js'
import { createFigmaProjectGateway } from './gateway.js'
import { registerProjectTools } from './mcp.js'

export const projectDomain = defineDomain({
	name: 'project',
	createApi: (client) => createProjectApi(createFigmaProjectGateway(client)),
	command: projectCommand,
	registerTools: registerProjectTools,
})
