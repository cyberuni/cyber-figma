import type { FigmaClient, QueryValue } from '../client.js'
import type { ActivityLog } from '../figma-types.js'
import { collectPages, type PaginatedResult, type PaginationSpec } from '../pagination.js'

// GET /v1/activity_logs — the org audit trail, intended for SIEM ingestion.
//
// Enterprise-only and **org admins only**, and the auth mode is the trap: the
// OpenAPI spec lists org OAuth 2 (scope org:activity_log_read) and a plan access
// token, and does *not* list a personal access token. A PAT will never work here
// however many scopes it carries.

/**
 * The endpoint returns `meta.cursor` and `meta.next_page`, and Figma documents
 * **no `cursor` request parameter to send them back to**. There is nothing to
 * page with, so this declares `none` — advertising a `--cursor` flag would hand
 * callers a value that silently re-requests the first page forever. To walk a
 * longer history, shift the `start_time`/`end_time` window and use `order`.
 */
export const ACTIVITY_LOG_PAGINATION: PaginationSpec = { model: 'none', itemsKey: 'activity_logs' }

export type ActivityLogOrder = 'asc' | 'desc'

export type ActivityLogQuery = {
	/** Event types to include. All events by default. */
	events?: string[]
	/** Unix seconds of the least recent event. Figma defaults to one year ago. */
	startTime?: number
	/** Unix seconds of the most recent event. Figma defaults to now. */
	endTime?: number
	/** Figma defaults to 1000. */
	limit?: number
	order?: ActivityLogOrder
}

export type ActivityLogResult = PaginatedResult<ActivityLog> & {
	/** `meta.next_page`: more events matched the window than this response carried. */
	has_more: boolean
	/**
	 * `meta.cursor` — "encodes the last event". Reported because Figma sends it,
	 * but no documented request parameter consumes it; narrow the time window
	 * instead of trying to page with it.
	 */
	cursor: string | null
}

export type ActivityLogGateway = {
	list: (query: ActivityLogQuery) => Promise<ActivityLogResult>
}

function record(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

export function createFigmaActivityLogGateway(client: FigmaClient): ActivityLogGateway {
	return {
		async list(query) {
			// The raw body is kept, because `next_page` and `cursor` live beside the
			// events in the envelope and the uniform result shape has no room for
			// them. Nothing here is unwrapped: `collectPages` reads through `meta`.
			let body: unknown
			const params: Record<string, QueryValue> = {
				...(query.events !== undefined && { events: query.events }),
				...(query.startTime !== undefined && { start_time: query.startTime }),
				...(query.endTime !== undefined && { end_time: query.endTime }),
				...(query.limit !== undefined && { limit: query.limit }),
				...(query.order !== undefined && { order: query.order }),
			}

			const result = await collectPages<ActivityLog>(ACTIVITY_LOG_PAGINATION, async () => {
				body = await client.request({ method: 'GET', path: '/v1/activity_logs', query: params })
				return body
			})

			const meta = record(record(body).meta)
			return {
				...result,
				has_more: meta.next_page === true,
				cursor: typeof meta.cursor === 'string' && meta.cursor ? meta.cursor : null,
			}
		},
	}
}
