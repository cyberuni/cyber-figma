import type { FigmaClient } from '../client.js'
import type {
	LibraryAnalyticsComponentActionsByAsset,
	LibraryAnalyticsComponentActionsByTeam,
	LibraryAnalyticsComponentUsagesByAsset,
	LibraryAnalyticsComponentUsagesByFile,
	LibraryAnalyticsStyleActionsByAsset,
	LibraryAnalyticsStyleActionsByTeam,
	LibraryAnalyticsStyleUsagesByAsset,
	LibraryAnalyticsStyleUsagesByFile,
	LibraryAnalyticsVariableActionsByAsset,
	LibraryAnalyticsVariableActionsByTeam,
	LibraryAnalyticsVariableUsagesByAsset,
	LibraryAnalyticsVariableUsagesByFile,
} from '../figma-types.js'
import { collectPages, type PaginatedResult, type PaginationOptions, type PaginationSpec } from '../pagination.js'

// Library Analytics: six endpoints under /v1/analytics/libraries/{file_key},
// one per (asset, metric) pair. They share a path shape, a pagination model, and
// a required `group_by` — and differ in exactly one thing, which is that the
// `actions` half is a weekly time series and the `usages` half is a snapshot
// with no date range at all. That asymmetry is in the types here so a command
// cannot offer a date window the endpoint would ignore.
//
// Enterprise-only, scope `library_analytics:read`. Reachable with a personal
// access token, a plan access token, or OAuth — unlike every other domain in
// this pod, which is why the acceptance specs here are the ones a non-Enterprise
// contributor is most likely to be able to promote to a system run.

/**
 * `{ rows, next_page: boolean, cursor? }` with `cursor` simply absent once
 * `next_page` is false. There is no `page_size` parameter — the 1000-row page
 * ceiling is Figma's, not the caller's — so this spec declares no sizes and the
 * derived CLI flags and MCP params offer none.
 */
export const LIBRARY_ANALYTICS_PAGINATION: PaginationSpec = { model: 'row_cursor', itemsKey: 'rows' }

/** The three library asset kinds analytics is reported for. */
export type LibraryAnalyticsAsset = 'component' | 'style' | 'variable'

export type LibraryAnalyticsActionRow =
	| LibraryAnalyticsComponentActionsByAsset
	| LibraryAnalyticsComponentActionsByTeam
	| LibraryAnalyticsStyleActionsByAsset
	| LibraryAnalyticsStyleActionsByTeam
	| LibraryAnalyticsVariableActionsByAsset
	| LibraryAnalyticsVariableActionsByTeam

export type LibraryAnalyticsUsageRow =
	| LibraryAnalyticsComponentUsagesByAsset
	| LibraryAnalyticsComponentUsagesByFile
	| LibraryAnalyticsStyleUsagesByAsset
	| LibraryAnalyticsStyleUsagesByFile
	| LibraryAnalyticsVariableUsagesByAsset
	| LibraryAnalyticsVariableUsagesByFile

export type LibraryAnalyticsRow = LibraryAnalyticsActionRow | LibraryAnalyticsUsageRow

export type ActionsQuery = {
	/** `component` | `style` | `variable` (the asset itself), or `team`. */
	groupBy: string
	/** `YYYY-MM-DD`; rounded back to the start of a week by Figma. */
	startDate?: string
	/** `YYYY-MM-DD`; rounded forward to the end of a week by Figma. */
	endDate?: string
}

export type UsagesQuery = {
	/** `component` | `style` | `variable` (the asset itself), or `file`. */
	groupBy: string
}

export type AnalyticsGateway = {
	actions: (
		asset: LibraryAnalyticsAsset,
		fileKey: string,
		query: ActionsQuery,
		opts?: PaginationOptions,
	) => Promise<PaginatedResult<LibraryAnalyticsActionRow>>
	usages: (
		asset: LibraryAnalyticsAsset,
		fileKey: string,
		query: UsagesQuery,
		opts?: PaginationOptions,
	) => Promise<PaginatedResult<LibraryAnalyticsUsageRow>>
}

function analyticsPath(asset: LibraryAnalyticsAsset, metric: 'actions' | 'usages', fileKey: string): string {
	return `/v1/analytics/libraries/${encodeURIComponent(fileKey)}/${asset}/${metric}`
}

export function createFigmaAnalyticsGateway(client: FigmaClient): AnalyticsGateway {
	function walk<Row>(path: string, params: Record<string, string>, opts?: PaginationOptions) {
		return collectPages<Row>(
			LIBRARY_ANALYTICS_PAGINATION,
			(page) =>
				client.request({
					method: 'GET',
					path,
					// The cursor goes on the wire, not into a side channel: it is the
					// only thing that advances one of these endpoints.
					query: { ...params, ...(page.cursor !== undefined && { cursor: page.cursor }) },
				}),
			opts,
		)
	}

	return {
		actions: (asset, fileKey, query, opts) =>
			walk<LibraryAnalyticsActionRow>(
				analyticsPath(asset, 'actions', fileKey),
				{
					group_by: query.groupBy,
					...(query.startDate !== undefined && { start_date: query.startDate }),
					...(query.endDate !== undefined && { end_date: query.endDate }),
				},
				opts,
			),
		usages: (asset, fileKey, query, opts) =>
			walk<LibraryAnalyticsUsageRow>(analyticsPath(asset, 'usages', fileKey), { group_by: query.groupBy }, opts),
	}
}
