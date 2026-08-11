import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { DiscoveryApi } from './api.js'

export function registerDiscoveryTools(server: McpServer, getApi: () => DiscoveryApi) {
	server.tool(
		'figma_discovery_text_events',
		'Download links for organization text events (in-file text, cursor chat, comments, component documentation, Dev Mode annotations, AI prompts) in a time window, one JSON file per hour. This returns links, not events: fetch each URL for that hour’s data. Requires an Enterprise plan with the Governance+ add-on and an org admin, and is reachable with OAuth 2 only (scope org:discovery_read) — neither a personal nor a plan access token can read it.',
		{
			start_date: z
				.string()
				.describe('Start of the window, ISO 8601 UTC (2026-01-01T00:00:00Z). Must be at least one hour in the past'),
			end_date: z
				.string()
				.optional()
				.describe('End of the window, ISO 8601 UTC. At most 24 hours after the start; defaults to one hour after'),
			file_ttl_in_seconds: z
				.number()
				.int()
				.min(60)
				.max(86_400)
				.optional()
				.describe('How long the returned links stay valid, 60–86400 seconds (Figma default 86400)'),
		},
		async ({ start_date, end_date, file_ttl_in_seconds }) => ({
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify(
						await getApi().textEvents({
							startDate: start_date,
							endDate: end_date,
							fileTtlSeconds: file_ttl_in_seconds,
						}),
					),
				},
			],
		}),
	)
}
