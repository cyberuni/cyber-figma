import type { FigmaClient } from '../client.js'
import type { PaginationSpec } from '../pagination.js'

// GET /v1/discovery — the text-event export: in-file text, cursor chat, comments
// and reactions, component documentation, Dev Mode annotations, and AI prompts.
//
// ⚠️ This endpoint is **absent from Figma's OpenAPI spec** and documented only
// at https://developers.figma.com/docs/rest-api/discovery-endpoints/, so its
// types are written by hand here rather than imported from figma-types.js.
//
// Enterprise **plus the Governance+ add-on**, org admins only, and **OAuth 2
// only** (scope org:discovery_read). Neither a personal nor a plan access token
// can reach it — run it with --auth-mode oauth.
//
// It is a two-stage API: the response hands back S3 download links, one JSON
// file per requested hour, which the caller then fetches. Links can be
// regenerated for the same window as often as needed; the URLs change, the
// content does not.

/** One response covers the whole window; there is nothing to page. */
export const DISCOVERY_PAGINATION: PaginationSpec = { model: 'none', itemsKey: 'urls' }

export type DiscoveryQuery = {
	/** ISO 8601 UTC instant. Must be at least one hour in the past. */
	startDate: string
	/** ISO 8601 UTC instant. Defaults to one hour after the start; 24 hours is the maximum span. */
	endDate?: string
	/** How long the returned links stay valid: 60–86400 seconds, Figma defaults to 86400. */
	fileTtlSeconds?: number
}

/** `meta` of the discovery response: download links keyed by hour, `"2026/01/01/00"`. */
export type DiscoveryTextEvents = {
	urls: Record<string, string[]>
}

export type DiscoveryGateway = {
	textEvents: (query: DiscoveryQuery) => Promise<DiscoveryTextEvents>
}

export function createFigmaDiscoveryGateway(client: FigmaClient): DiscoveryGateway {
	return {
		textEvents: (query) =>
			client.request<DiscoveryTextEvents>({
				method: 'GET',
				path: '/v1/discovery',
				query: {
					start_date: query.startDate,
					...(query.endDate !== undefined && { end_date: query.endDate }),
					...(query.fileTtlSeconds !== undefined && { file_ttl_in_seconds: query.fileTtlSeconds }),
				},
				unwrap: 'meta',
			}),
	}
}
