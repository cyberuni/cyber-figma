import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { UserApi } from './api.js'

export function registerUserTools(server: McpServer, getApi: () => UserApi) {
	server.tool(
		'figma_user_me',
		'Show the Figma account the current credential belongs to — the connection check for a personal access token or OAuth. Not reachable with a plan access token.',
		{},
		async () => ({ content: [{ type: 'text' as const, text: JSON.stringify(await getApi().me()) }] }),
	)
}
