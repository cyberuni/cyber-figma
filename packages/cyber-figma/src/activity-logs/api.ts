import type { ActivityLogGateway, ActivityLogOrder, ActivityLogResult } from './gateway.js'

// The operations the CLI and MCP both call. Figma takes the window as Unix
// seconds, which nobody writes by hand, so an ISO instant or a plain date is
// accepted everywhere a timestamp is and converted here — and everything Figma
// would answer with a 400 is caught before the request is spent.

export type ActivityLogListOptions = {
	/** Comma-separated event types, or a list. All events by default. */
	events?: string | string[]
	/** Unix seconds, an ISO 8601 instant, or `YYYY-MM-DD`. Figma defaults to one year ago. */
	startTime?: string | number
	endTime?: string | number
	/** Figma defaults to 1000. */
	limit?: number
	order?: string
}

export type ActivityLogApi = {
	list: (opts: ActivityLogListOptions) => Promise<ActivityLogResult>
}

const ORDERS: ActivityLogOrder[] = ['asc', 'desc']
const UNIX_SECONDS = /^\d{1,11}$/

/**
 * A time bound as Figma wants it: Unix seconds. A bare number passes through; an
 * ISO 8601 instant or a `YYYY-MM-DD` date (midnight UTC) is converted.
 */
export function parseActivityLogTime(label: string, value: string | number | undefined): number | undefined {
	if (value === undefined) return undefined
	if (typeof value === 'number') {
		if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a whole number of Unix seconds.`)
		return value
	}

	const trimmed = value.trim()
	if (UNIX_SECONDS.test(trimmed)) return Number(trimmed)

	const parsed = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T00:00:00Z` : trimmed)
	if (Number.isNaN(parsed)) {
		throw new Error(
			`${label} must be Unix seconds, an ISO 8601 instant (2026-01-31T00:00:00Z), or a YYYY-MM-DD date — not "${value}".`,
		)
	}
	return Math.floor(parsed / 1000)
}

function parseEvents(events: ActivityLogListOptions['events']): string[] | undefined {
	if (events === undefined) return undefined
	const list = (Array.isArray(events) ? events : events.split(',')).map((event) => event.trim()).filter(Boolean)
	return list.length > 0 ? list : undefined
}

function parseOrder(order: string | undefined): ActivityLogOrder | undefined {
	if (order === undefined) return undefined
	if (!ORDERS.includes(order as ActivityLogOrder)) {
		throw new Error(`order must be asc or desc, not "${order}".`)
	}
	return order as ActivityLogOrder
}

function parseLimit(limit: number | undefined): number | undefined {
	if (limit === undefined) return undefined
	if (!Number.isInteger(limit) || limit < 1) throw new Error(`limit must be a positive integer, not "${limit}".`)
	return limit
}

export function createActivityLogApi(gateway: ActivityLogGateway): ActivityLogApi {
	return {
		// `async` so a validation failure arrives as a rejection like any API failure.
		async list(opts) {
			const startTime = parseActivityLogTime('start_time', opts.startTime)
			const endTime = parseActivityLogTime('end_time', opts.endTime)
			if (startTime !== undefined && endTime !== undefined && endTime < startTime) {
				throw new Error(`end_time (${endTime}) is before start_time (${startTime}); the window would match nothing.`)
			}

			return gateway.list({
				events: parseEvents(opts.events),
				startTime,
				endTime,
				limit: parseLimit(opts.limit),
				order: parseOrder(opts.order),
			})
		},
	}
}
