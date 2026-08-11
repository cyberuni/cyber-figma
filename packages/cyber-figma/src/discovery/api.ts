import type { DiscoveryGateway, DiscoveryQuery } from './gateway.js'

// The operations the CLI and MCP both call. Discovery's own error table is
// unlike the rest of the API — it describes both 401 and 403 as "the OAuth token
// is invalid" — so a window this endpoint would refuse is worth catching before
// the request, where the reason can be named.

/** One hour of the window, and the download links Figma generated for it. */
export type DiscoveryHour = {
	/** Figma's hour key, `2026/01/01/00`. */
	hour: string
	urls: string[]
}

export type DiscoveryTextEventsResult = {
	hours: DiscoveryHour[]
	total_urls: number
}

export type DiscoveryApi = {
	textEvents: (opts: DiscoveryQuery) => Promise<DiscoveryTextEventsResult>
}

const AN_HOUR = 60 * 60 * 1000
const MAX_WINDOW = 24 * AN_HOUR
const MIN_TTL_SECONDS = 60
const MAX_TTL_SECONDS = 86_400

function requireInstant(label: string, value: string | undefined): number {
	if (!value) {
		throw new Error(`${label} is required: an ISO 8601 UTC instant such as 2026-01-01T00:00:00Z.`)
	}
	const parsed = Date.parse(value)
	if (Number.isNaN(parsed)) {
		throw new Error(`${label} must be an ISO 8601 UTC instant such as 2026-01-01T00:00:00Z, not "${value}".`)
	}
	return parsed
}

export function createDiscoveryApi(gateway: DiscoveryGateway, now: () => number = Date.now): DiscoveryApi {
	return {
		// `async` so a validation failure arrives as a rejection like any API failure.
		async textEvents(opts) {
			const start = requireInstant('start_date', opts.startDate)
			if (start > now() - AN_HOUR) {
				throw new Error(
					'start_date must be at least one hour in the past: Figma has not finished assembling more recent text events.',
				)
			}

			if (opts.endDate !== undefined) {
				const end = requireInstant('end_date', opts.endDate)
				if (end <= start) {
					throw new Error(`end_date (${opts.endDate}) must be after start_date (${opts.startDate}).`)
				}
				if (end - start > MAX_WINDOW) {
					throw new Error('end_date can be at most 24 hours after start_date; ask for the rest in a second window.')
				}
			}

			if (opts.fileTtlSeconds !== undefined) {
				const ttl = opts.fileTtlSeconds
				if (!Number.isInteger(ttl) || ttl < MIN_TTL_SECONDS || ttl > MAX_TTL_SECONDS) {
					throw new Error(
						`file_ttl_in_seconds must be a whole number between ${MIN_TTL_SECONDS} and ${MAX_TTL_SECONDS}, not "${ttl}".`,
					)
				}
			}

			const { urls } = await gateway.textEvents(opts)
			const hours = Object.entries(urls ?? {}).map(([hour, links]) => ({ hour, urls: links }))

			return { hours, total_urls: hours.reduce((total, entry) => total + entry.urls.length, 0) }
		},
	}
}
