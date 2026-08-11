import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { PaymentApi } from './api.js'

export function registerPaymentTools(server: McpServer, getApi: () => PaymentApi) {
	server.tool(
		'figma_payment_get',
		'Check one user’s purchase state on a plugin, widget, or Community file you own. Two modes: a plugin_payment_token from getPluginPaymentTokenAsync (inside a plugin or widget), or a user_id plus exactly one resource id (from a server). Personal access token only — the Payments API has no OAuth 2 support at all and no plan access token support either.',
		{
			plugin_payment_token: z
				.string()
				.optional()
				.describe('Short-lived token from getPluginPaymentTokenAsync, used inside a plugin or widget'),
			user_id: z
				.string()
				.optional()
				.describe('Figma user id to ask about, obtained by having the user OAuth to the REST API'),
			community_file_id: z.string().optional().describe('Community file id: the number after "file/" on its page'),
			plugin_id: z.string().optional().describe('Plugin id'),
			widget_id: z.string().optional().describe('Widget id'),
		},
		async ({ plugin_payment_token, user_id, community_file_id, plugin_id, widget_id }) => ({
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify(
						await getApi().get({
							pluginPaymentToken: plugin_payment_token,
							userId: user_id,
							communityFileId: community_file_id,
							pluginId: plugin_id,
							widgetId: widget_id,
						}),
					),
				},
			],
		}),
	)
}
