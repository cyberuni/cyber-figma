import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { paginationOptions, paginationParams } from '../mcp-options.js'
import type { AiUsageApi } from './api.js'
import { AI_USAGE_PAGINATION } from './gateway.js'

export function registerAiUsageTools(server: McpServer, getApi: () => AiUsageApi) {
	server.tool(
		'figma_ai_usage_daily',
		'Per-user, per-day AI credit usage for the organization over a date window. Requires an Enterprise plan and an org admin, and is reachable with a plan access token only (scope org:ai_metering_usage_read) — a personal access token cannot read it. Data lags real time by 5–6 hours, so the current day is incomplete.',
		{
			start_date: z.string().describe('First day to include, inclusive, YYYY-MM-DD UTC. No earlier than 2025-12-01'),
			end_date: z.string().describe('Last day to include, inclusive, YYYY-MM-DD UTC. Today or earlier'),
			user_email: z
				.string()
				.optional()
				.describe('Restrict to one user. An address matching no Figma user is an error, not an empty result'),
			...paginationParams(AI_USAGE_PAGINATION),
		},
		async ({ start_date, end_date, user_email, ...page }) => ({
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify(
						await getApi().daily({
							startDate: start_date,
							endDate: end_date,
							userEmail: user_email,
							...paginationOptions(page),
						}),
					),
				},
			],
		}),
	)
}
