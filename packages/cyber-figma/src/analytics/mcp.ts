import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { paginationOptions, paginationParams } from '../mcp-options.js'
import { type AnalyticsApi, groupByChoices } from './api.js'
import { LIBRARY_ANALYTICS_PAGINATION, type LibraryAnalyticsAsset } from './gateway.js'

// One tool per (asset, metric) pair. The `group_by` enum is built from the same
// source the CLI choices come from, so a client reading the tool schema is told
// the two dimensions this endpoint really has rather than the union of all six.

const ASSETS: LibraryAnalyticsAsset[] = ['component', 'style', 'variable']

const PLAN_NOTE =
	'Requires an Enterprise plan and the library_analytics:read scope. Data is recomputed daily at 00:00 UTC. Rows you lack permission for come back named "Team not visible" / "File not visible" rather than being dropped.'

function groupBySchema(asset: LibraryAnalyticsAsset, metric: 'actions' | 'usages') {
	const [own, other] = groupByChoices(asset, metric)
	return z.enum([own, other] as [string, string]).describe(`Dimension to group rows by: ${own} or ${other}`)
}

const json = (result: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(result) }] })

export function registerAnalyticsTools(server: McpServer, getApi: () => AnalyticsApi) {
	for (const asset of ASSETS) {
		server.tool(
			`figma_analytics_${asset}_actions`,
			`Weekly ${asset} insertions and detachments for a published library file. ${PLAN_NOTE}`,
			{
				file: z.string().describe('Key or URL of the published library file'),
				group_by: groupBySchema(asset, 'actions'),
				start_date: z.string().optional().describe('YYYY-MM-DD; rounded back to the start of that week'),
				end_date: z.string().optional().describe('YYYY-MM-DD; rounded forward to the end of that week'),
				...paginationParams(LIBRARY_ANALYTICS_PAGINATION),
			},
			async ({ file, group_by, start_date, end_date, ...page }) =>
				json(
					await getApi().actions(asset, file, {
						groupBy: group_by,
						startDate: start_date,
						endDate: end_date,
						...paginationOptions(page),
					}),
				),
		)

		server.tool(
			`figma_analytics_${asset}_usages`,
			`Current ${asset} usage across the organization for a published library file — a snapshot with no date range. ${PLAN_NOTE}`,
			{
				file: z.string().describe('Key or URL of the published library file'),
				group_by: groupBySchema(asset, 'usages'),
				...paginationParams(LIBRARY_ANALYTICS_PAGINATION),
			},
			async ({ file, group_by, ...page }) =>
				json(await getApi().usages(asset, file, { groupBy: group_by, ...paginationOptions(page) })),
		)
	}
}
