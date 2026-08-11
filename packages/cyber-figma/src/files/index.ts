import { defineDomain } from '../composition.js'
import { createFileApi } from './api.js'
import { fileCommand } from './cli.js'
import { createFigmaFileGateway } from './gateway.js'
import { registerFileTools } from './mcp.js'

export const fileDomain = defineDomain({
	name: 'file',
	createApi: (client) => createFileApi(createFigmaFileGateway(client)),
	command: fileCommand,
	registerTools: registerFileTools,
})
