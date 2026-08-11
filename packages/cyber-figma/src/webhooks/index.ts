import { defineDomain } from '../composition.js'
import { createWebhookApi } from './api.js'
import { webhookCommand } from './cli.js'
import { createFigmaWebhookGateway } from './gateway.js'
import { registerWebhookTools } from './mcp.js'

export const webhookDomain = defineDomain({
	name: 'webhook',
	createApi: (client) => createWebhookApi(createFigmaWebhookGateway(client)),
	command: webhookCommand,
	registerTools: registerWebhookTools,
})
