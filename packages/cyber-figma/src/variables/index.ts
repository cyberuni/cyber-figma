import { defineDomain } from '../composition.js'
import { createVariableApi } from './api.js'
import { variableCommand } from './cli.js'
import { createFigmaVariableGateway } from './gateway.js'
import { registerVariableTools } from './mcp.js'

export const variableDomain = defineDomain({
	name: 'variable',
	createApi: (client) => createVariableApi(createFigmaVariableGateway(client)),
	command: variableCommand,
	registerTools: registerVariableTools,
})
