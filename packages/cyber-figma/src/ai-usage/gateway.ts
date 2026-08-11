import type { FigmaClient } from '../client.js'
import type { AiUsageDailyRow } from '../figma-types.js'
import {
	collectPages,
	type PaginatedResult,
	type PaginationOptions,
	type PaginationSpec,
	paginationParamsFor,
} from '../pagination.js'

// GET /v1/ai_usage/daily — per-user, per-day AI credit aggregates for the plan.
//
// Enterprise-only, org admins only, and reachable with a **plan access token
// only** (scope org:ai_metering_usage_read): only an admin can mint one, and no
// personal access token will do. Figma's data lags real time by five to six
// hours, so the current day is always incomplete.

/**
 * `{ rows, next_cursor, has_next_page }` — `next_cursor` is the **empty string**
 * once exhausted, not null, which is the same model Developer Logs uses under
 * different field names.
 */
export const AI_USAGE_PAGINATION: PaginationSpec = {
	model: 'next_cursor',
	itemsKey: 'rows',
	defaultPageSize: 1000,
	maxPageSize: 1000,
}

export type AiUsageQuery = {
	/** `YYYY-MM-DD` UTC, inclusive. Figma rejects anything before 2025-12-01. */
	startDate: string
	/** `YYYY-MM-DD` UTC, inclusive. */
	endDate: string
	/** One user. An address matching no Figma user is a 400, not an empty result. */
	userEmail?: string
}

export type AiUsageGateway = {
	daily: (query: AiUsageQuery, opts?: PaginationOptions) => Promise<PaginatedResult<AiUsageDailyRow>>
}

export function createFigmaAiUsageGateway(client: FigmaClient): AiUsageGateway {
	return {
		daily: (query, opts) =>
			collectPages<AiUsageDailyRow>(
				AI_USAGE_PAGINATION,
				(page) =>
					client.request({
						method: 'GET',
						path: '/v1/ai_usage/daily',
						query: {
							start_date: query.startDate,
							end_date: query.endDate,
							...(query.userEmail !== undefined && { user_email: query.userEmail }),
							...paginationParamsFor(AI_USAGE_PAGINATION, page),
						},
					}),
				opts,
			),
	}
}
