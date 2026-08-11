import { defineDomain } from '../composition.js'
import { createAiUsageApi } from './api.js'
import { aiUsageCommand } from './cli.js'
import { createFigmaAiUsageGateway } from './gateway.js'
import { registerAiUsageTools } from './mcp.js'

export const aiUsageDomain = defineDomain({
	name: 'ai-usage',
	createApi: (client) => createAiUsageApi(createFigmaAiUsageGateway(client)),
	command: aiUsageCommand,
	registerTools: registerAiUsageTools,
})
