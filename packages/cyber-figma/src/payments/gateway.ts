import type { FigmaClient } from '../client.js'
import { isFigmaApiError } from '../figma-error.js'
import type { PaymentInformation } from '../figma-types.js'

// GET /v1/payments — has this user paid for my plugin, widget, or Community
// file? Used from a plugin (with a short-lived plugin payment token) or from a
// server (with a user id and one resource id).
//
// The odd one out of this pod in every respect: no plan gate at all, but
// **personal access token only** — the docs state plainly that the Payments REST
// API does not support OAuth 2, and the spec lists no plan-token support either.
// You can only ask about resources **you own**.

export type PaymentQuery = {
	/** From `getPluginPaymentTokenAsync` in the Plugin Payments API; used from plugin or widget code. */
	pluginPaymentToken?: string
	/** The Figma user to ask about. Obtained by having them OAuth to the REST API. */
	userId?: string
	communityFileId?: string
	pluginId?: string
	widgetId?: string
}

export type PaymentGateway = {
	get: (query: PaymentQuery) => Promise<PaymentInformation>
}

const WRONG_CREDENTIAL_HINT =
	'The Payments API accepts a personal access token only: it has no OAuth 2 support at all, and the spec lists no plan access token support either. Re-run with --auth-mode personal and a PAT belonging to the account that owns the plugin, widget, or Community file — you can only query resources you own.'

export function createFigmaPaymentGateway(client: FigmaClient): PaymentGateway {
	return {
		async get(query) {
			try {
				return await client.request<PaymentInformation>({
					method: 'GET',
					path: '/v1/payments',
					query: {
						...(query.pluginPaymentToken !== undefined && { plugin_payment_token: query.pluginPaymentToken }),
						...(query.userId !== undefined && { user_id: query.userId }),
						...(query.communityFileId !== undefined && { community_file_id: query.communityFileId }),
						...(query.pluginId !== undefined && { plugin_id: query.pluginId }),
						...(query.widgetId !== undefined && { widget_id: query.widgetId }),
					},
					unwrap: 'meta',
				})
			} catch (error) {
				// The credential is the likeliest cause of a refusal here and the
				// status code cannot say so, so the operation says it — an attached
				// hint outranks the one the spine derives. On a personal access token
				// the spine's own 403 explanation is the better one, so it is left
				// alone.
				if (
					isFigmaApiError(error) &&
					client.authMode !== 'personal' &&
					(error.status === 401 || error.status === 403)
				) {
					Object.assign(error, { hint: WRONG_CREDENTIAL_HINT })
				}
				throw error
			}
		},
	}
}
