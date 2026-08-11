import type { PaymentInformation } from '../figma-types.js'
import type { PaymentGateway, PaymentQuery } from './gateway.js'

// The operations the CLI and MCP both call. The endpoint has two distinct usage
// modes and Figma answers a malformed mix of them with a bare 400, so the shape
// of the request is checked here where the two modes can be named.

export type PaymentApi = {
	get: (opts: PaymentQuery) => Promise<PaymentInformation>
}

const RESOURCE_KEYS = ['communityFileId', 'pluginId', 'widgetId'] as const
const RESOURCE_PARAMS = 'community_file_id, plugin_id, widget_id'

const OWNERSHIP_NOTE = 'You can only query a plugin, widget, or Community file you own.'

export function createPaymentApi(gateway: PaymentGateway): PaymentApi {
	return {
		// `async` so a validation failure arrives as a rejection like any API failure.
		async get(opts) {
			const resources = RESOURCE_KEYS.filter((key) => opts[key] !== undefined)

			if (opts.pluginPaymentToken === undefined && opts.userId === undefined) {
				throw new Error(
					`The Payments API has two modes: a plugin_payment_token from getPluginPaymentTokenAsync (used inside a plugin or widget), or a user_id plus exactly one of ${RESOURCE_PARAMS} (used from a server). Supply one of them. ${OWNERSHIP_NOTE}`,
				)
			}

			if (opts.userId !== undefined && resources.length !== 1) {
				throw new Error(
					`A user_id needs exactly one of ${RESOURCE_PARAMS} to ask about — ${resources.length} were given. ${OWNERSHIP_NOTE}`,
				)
			}

			return gateway.get(opts)
		},
	}
}
