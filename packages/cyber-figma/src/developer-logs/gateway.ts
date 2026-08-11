import type { FigmaClient } from '../client.js'
import type { DeveloperLog } from '../figma-types.js'
import {
	collectPages,
	type PaginatedResult,
	type PaginationOptions,
	type PaginationSpec,
	paginationParamsFor,
} from '../pagination.js'

// POST /v1/developer_logs — who called the REST API and the MCP server, from
// this organization. It is a **read that uses POST**: the filters go in the
// body, not the query string, and nothing is mutated.
//
// Enterprise **plus the Governance+ add-on**, org admins only, and reachable
// with a **plan access token only** (scope org:developer_log_read) — the spec
// lists no other security scheme, so neither a personal access token nor OAuth
// will work. Records are retained 30 days; nothing older exists to ask for.

/**
 * `meta: { items, cursor, has_more }` with `cursor` **null** once exhausted —
 * the same model AI Usage uses under three different field names, which is why
 * it is named separately. `cursor` and `limit` travel in the body here.
 */
export const DEVELOPER_LOG_PAGINATION: PaginationSpec = { model: 'meta_cursor', itemsKey: 'items' }

export type DeveloperLogTokenType = 'plan_access_token' | 'developer_token' | 'oauth_token'
export type DeveloperLogEventSource = 'rest_api' | 'mcp_server'
export type DeveloperLogDateRange = 'last_24h' | 'last_7d' | 'last_30d'

export type DeveloperLogFilters = {
	tokenType?: DeveloperLogTokenType
	/** Token value(s) — comma-separated prefixes are accepted by Figma. */
	token?: string
	tokenName?: string
	userEmail?: string
	ipAddress?: string
	eventSource?: DeveloperLogEventSource
	/** Figma's own window; records older than 30 days do not exist. */
	dateRange?: DeveloperLogDateRange
}

export type DeveloperLogGateway = {
	list: (filters: DeveloperLogFilters, opts?: PaginationOptions) => Promise<PaginatedResult<DeveloperLog>>
}

export function createFigmaDeveloperLogGateway(client: FigmaClient): DeveloperLogGateway {
	return {
		list: (filters, opts) => {
			const body = {
				...(filters.tokenType !== undefined && { token_type: filters.tokenType }),
				...(filters.token !== undefined && { token: filters.token }),
				...(filters.tokenName !== undefined && { token_name: filters.tokenName }),
				...(filters.userEmail !== undefined && { user_email: filters.userEmail }),
				...(filters.ipAddress !== undefined && { ip_address: filters.ipAddress }),
				...(filters.eventSource !== undefined && { event_source: filters.eventSource }),
				...(filters.dateRange !== undefined && { date_range: filters.dateRange }),
			}

			return collectPages<DeveloperLog>(
				DEVELOPER_LOG_PAGINATION,
				(page) =>
					client.request({
						method: 'POST',
						path: '/v1/developer_logs',
						// The pagination parameters join the filters in the body. Sending
						// them as query parameters would be silently ignored, and the walk
						// would re-request the first page forever.
						body: { ...body, ...paginationParamsFor(DEVELOPER_LOG_PAGINATION, page) },
					}),
				opts,
			)
		},
	}
}
