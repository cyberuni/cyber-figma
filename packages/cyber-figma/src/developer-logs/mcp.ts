import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { paginationOptions, paginationParams } from '../mcp-options.js'
import {
	DEVELOPER_LOG_DATE_RANGES,
	DEVELOPER_LOG_EVENT_SOURCES,
	DEVELOPER_LOG_TOKEN_TYPES,
	type DeveloperLogApi,
} from './api.js'
import { DEVELOPER_LOG_PAGINATION } from './gateway.js'

export function registerDeveloperLogTools(server: McpServer, getApi: () => DeveloperLogApi) {
	server.tool(
		'figma_developer_log_list',
		'List organization developer log entries — every REST API and MCP server request made against this org, retained 30 days. Requires an Enterprise plan with the Governance+ add-on and an org admin, and is reachable with a plan access token only (scope org:developer_log_read): neither a personal access token nor OAuth can read it.',
		{
			token_type: z.enum(DEVELOPER_LOG_TOKEN_TYPES).optional().describe('Filter by the kind of credential used'),
			token: z
				.string()
				.optional()
				.describe('Filter by token value prefix (comma-separated). This is a secret — prefer token_name'),
			token_name: z.string().optional().describe('Filter by token name prefix (comma-separated)'),
			user_email: z.string().optional().describe('Filter by user email prefix (comma-separated)'),
			ip_address: z.string().optional().describe('Filter by IP address prefix (comma-separated)'),
			event_source: z.enum(DEVELOPER_LOG_EVENT_SOURCES).optional().describe('Filter to REST API or MCP server calls'),
			date_range: z.enum(DEVELOPER_LOG_DATE_RANGES).optional().describe('Window to search; 30-day retention'),
			...paginationParams(DEVELOPER_LOG_PAGINATION),
		},
		async ({ token_type, token, token_name, user_email, ip_address, event_source, date_range, ...page }) => ({
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify(
						await getApi().list({
							tokenType: token_type,
							token,
							tokenName: token_name,
							userEmail: user_email,
							ipAddress: ip_address,
							eventSource: event_source,
							dateRange: date_range,
							...paginationOptions(page),
						}),
					),
				},
			],
		}),
	)
}
