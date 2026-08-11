import type { PaginatedResult, PaginationOptions } from '../pagination.js'
import { fileKeyFromInput } from '../url.js'
import type {
	AnalyticsGateway,
	LibraryAnalyticsActionRow,
	LibraryAnalyticsAsset,
	LibraryAnalyticsUsageRow,
} from './gateway.js'

// The operations the CLI and MCP both call. Everything Figma would answer with
// a 400 is caught here instead: `group_by` is required and its legal values
// differ per (asset, metric) pair, and the date format is exact. A wrong value
// costs a round trip and returns a message that does not name the alternatives.

export type ActionsOptions = PaginationOptions & {
	/** The asset kind itself, or `team`. */
	groupBy: string
	/** `YYYY-MM-DD`. Figma rounds it back to the start of that week. */
	startDate?: string
	/** `YYYY-MM-DD`. Figma rounds it forward to the end of that week. */
	endDate?: string
}

export type UsagesOptions = PaginationOptions & {
	/** The asset kind itself, or `file`. */
	groupBy: string
}

export type AnalyticsApi = {
	actions: (
		asset: LibraryAnalyticsAsset,
		file: string,
		opts: ActionsOptions,
	) => Promise<PaginatedResult<LibraryAnalyticsActionRow>>
	usages: (
		asset: LibraryAnalyticsAsset,
		file: string,
		opts: UsagesOptions,
	) => Promise<PaginatedResult<LibraryAnalyticsUsageRow>>
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** The dimensions this (asset, metric) pair groups by — the asset itself, plus one other. */
export function groupByChoices(asset: LibraryAnalyticsAsset, metric: 'actions' | 'usages'): string[] {
	return [asset, metric === 'actions' ? 'team' : 'file']
}

function requireGroupBy(asset: LibraryAnalyticsAsset, metric: 'actions' | 'usages', groupBy: string): string {
	const choices = groupByChoices(asset, metric)
	if (!choices.includes(groupBy)) {
		throw new Error(
			`group_by must be one of ${choices.join(' | ')} for ${asset} ${metric}, not "${groupBy}". Figma's grouping dimensions differ per endpoint: the actions endpoints group by the asset or by team, the usages endpoints by the asset or by file.`,
		)
	}
	return groupBy
}

function requireIsoDate(label: string, value: string | undefined): string | undefined {
	if (value !== undefined && !ISO_DATE.test(value)) {
		throw new Error(`${label} must be an ISO 8601 calendar date in YYYY-MM-DD form, not "${value}".`)
	}
	return value
}

export function createAnalyticsApi(gateway: AnalyticsGateway): AnalyticsApi {
	return {
		// `async` so a validation failure arrives as a rejection like any API
		// failure, rather than throwing synchronously at the call site.
		actions: async (asset, file, opts) =>
			gateway.actions(
				asset,
				fileKeyFromInput(file),
				{
					groupBy: requireGroupBy(asset, 'actions', opts.groupBy),
					startDate: requireIsoDate('start_date', opts.startDate),
					endDate: requireIsoDate('end_date', opts.endDate),
				},
				opts,
			),
		usages: async (asset, file, opts) =>
			gateway.usages(asset, fileKeyFromInput(file), { groupBy: requireGroupBy(asset, 'usages', opts.groupBy) }, opts),
	}
}
