import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ActivityLogApi } from './api.js'

export function registerActivityLogTools(server: McpServer, getApi: () => ActivityLogApi) {
	server.tool(
		'figma_activity_log_list',
		'List organization activity log events (audit trail) in a time window. Requires an Enterprise plan and an org admin, authenticated with org OAuth (scope org:activity_log_read) or a plan access token — a personal access token cannot reach this endpoint. The response reports has_more but Figma documents no cursor to page with: narrow the time window instead.',
		{
			events: z.string().optional().describe('Comma-separated event types; all events by default'),
			start_time: z
				.string()
				.optional()
				.describe('Least recent event: Unix seconds, an ISO 8601 instant, or YYYY-MM-DD. Defaults to one year ago'),
			end_time: z.string().optional().describe('Most recent event, same formats. Defaults to now'),
			limit: z.number().int().min(1).optional().describe('Maximum events to return (Figma default 1000)'),
			order: z.enum(['asc', 'desc']).optional().describe('Order by timestamp; asc is Figma default'),
		},
		async ({ events, start_time, end_time, limit, order }) => ({
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify(await getApi().list({ events, startTime: start_time, endTime: end_time, limit, order })),
				},
			],
		}),
	)
}
