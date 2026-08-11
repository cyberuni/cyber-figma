import { defineDomain } from '../composition.js'
import { createUserApi } from './api.js'
import { userCommand } from './cli.js'
import { createFigmaUserGateway } from './gateway.js'
import { registerUserTools } from './mcp.js'

export const userDomain = defineDomain({
	name: 'user',
	createApi: (client) => createUserApi(createFigmaUserGateway(client)),
	command: userCommand,
	registerTools: registerUserTools,
})
