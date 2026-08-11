import { defineDomain } from '../composition.js'
import { createPaymentApi } from './api.js'
import { paymentCommand } from './cli.js'
import { createFigmaPaymentGateway } from './gateway.js'
import { registerPaymentTools } from './mcp.js'

export const paymentDomain = defineDomain({
	name: 'payment',
	createApi: (client) => createPaymentApi(createFigmaPaymentGateway(client)),
	command: paymentCommand,
	registerTools: registerPaymentTools,
})
