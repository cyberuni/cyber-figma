import { defineDomain } from '../composition.js'
import { createOEmbedApi } from './api.js'
import { oembedCommand } from './cli.js'
import { createFigmaOEmbedGateway } from './gateway.js'
import { registerOEmbedTools } from './mcp.js'

export const oembedDomain = defineDomain({
	name: 'oembed',
	createApi: (client) => createOEmbedApi(createFigmaOEmbedGateway(client)),
	command: oembedCommand,
	registerTools: registerOEmbedTools,
})
