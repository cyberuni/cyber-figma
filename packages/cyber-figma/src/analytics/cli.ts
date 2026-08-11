import { Command, Option } from 'commander'
import {
	addPaginationOptions,
	type PaginationCliOptions,
	paginationOptionsFromCli,
	printNextPageHint,
} from '../cli-options.js'
import { output, printCountSummary, printNextSteps, printTable } from '../output.js'
import type { PaginatedResult } from '../pagination.js'
import { isFull, truncate } from '../truncate.js'
import { type AnalyticsApi, groupByChoices } from './api.js'
import { LIBRARY_ANALYTICS_PAGINATION, type LibraryAnalyticsAsset, type LibraryAnalyticsRow } from './gateway.js'

// Six commands, one per (asset, metric) pair, because the two halves genuinely
// differ: `actions` is a weekly time series with a date window, `usages` is a
// snapshot with none. Collapsing them into one command would have to advertise
// date flags that half the endpoints ignore.

type ActionsCliOptions = PaginationCliOptions & { groupBy: string; startDate?: string; endDate?: string }
type UsagesCliOptions = PaginationCliOptions & { groupBy: string }

const ROW_LIMIT = 60

/**
 * Analytics rows have a different shape per grouping dimension — by asset, by
 * team, by file — so the columns come from the row Figma actually sent rather
 * than from a fixed list that would silently drop half of them.
 */
function printRows(rows: LibraryAnalyticsRow[], entity: string) {
	const first = rows[0]
	if (!first) {
		printTable([], [], { entity })
		return
	}
	const columns = Object.keys(first).map((key) => ({
		label: key,
		get: (row: LibraryAnalyticsRow) =>
			truncate(String((row as Record<string, unknown>)[key] ?? ''), { full: isFull() }),
	}))
	const shown = isFull() ? rows : rows.slice(0, ROW_LIMIT)
	printTable(shown, columns, { entity })
	if (shown.length < rows.length) {
		console.log(`\n… ${rows.length - shown.length} more row(s) not shown; use --full or --json.`)
	}
}

function report(result: PaginatedResult<LibraryAnalyticsRow>, entity: string, nextPage: string, nextSteps: string[]) {
	output(result, () => {
		printRows(result.data, entity)
		printCountSummary(result.count, `${entity} row(s)`)
		printNextPageHint(result, nextPage)
		printNextSteps(nextSteps)
	})
}

function groupByOption(asset: LibraryAnalyticsAsset, metric: 'actions' | 'usages'): Option {
	return new Option('--group-by <dimension>', 'Dimension to group the rows by')
		.choices(groupByChoices(asset, metric))
		.makeOptionMandatory()
}

function actionsCommand(cmd: Command, getApi: () => AnalyticsApi, asset: LibraryAnalyticsAsset): Command {
	const name = `${asset}-actions`
	return addPaginationOptions(
		cmd
			.command(name)
			.description(`Weekly ${asset} insertions and detachments for a library (Enterprise plan)`)
			.argument('<file>', 'Key or URL of the published library file')
			.addOption(groupByOption(asset, 'actions'))
			.option('--start-date <YYYY-MM-DD>', 'Earliest week to include (rounded back to a week start)')
			.option('--end-date <YYYY-MM-DD>', 'Latest week to include (rounded forward to a week end)')
			.action(async (file: string, opts: ActionsCliOptions) => {
				const result = await getApi().actions(asset, file, {
					groupBy: opts.groupBy,
					startDate: opts.startDate,
					endDate: opts.endDate,
					...paginationOptionsFromCli(opts),
				})
				report(result, `${asset} action`, `cyber-figma analytics ${name} ${file} --group-by ${opts.groupBy}`, [
					`cyber-figma analytics ${asset}-usages ${file} --group-by ${asset}`,
				])
			}),
		LIBRARY_ANALYTICS_PAGINATION,
	)
}

function usagesCommand(cmd: Command, getApi: () => AnalyticsApi, asset: LibraryAnalyticsAsset): Command {
	const name = `${asset}-usages`
	return addPaginationOptions(
		cmd
			.command(name)
			.description(`Current ${asset} usage across the org — a snapshot, not a time series (Enterprise plan)`)
			.argument('<file>', 'Key or URL of the published library file')
			.addOption(groupByOption(asset, 'usages'))
			.action(async (file: string, opts: UsagesCliOptions) => {
				const result = await getApi().usages(asset, file, {
					groupBy: opts.groupBy,
					...paginationOptionsFromCli(opts),
				})
				report(result, `${asset} usage`, `cyber-figma analytics ${name} ${file} --group-by ${opts.groupBy}`, [
					`cyber-figma analytics ${asset}-actions ${file} --group-by ${asset}`,
				])
			}),
		LIBRARY_ANALYTICS_PAGINATION,
	)
}

export function analyticsCommand(getApi: () => AnalyticsApi): Command {
	const cmd = new Command('analytics').description(
		'Library Analytics for a published library file. Enterprise plan only, scope library_analytics:read. Figma recomputes the data daily at 00:00 UTC, and obfuscates names you cannot see as "Team not visible" / "File not visible" rather than dropping the rows.',
	)

	for (const asset of ['component', 'style', 'variable'] as LibraryAnalyticsAsset[]) {
		actionsCommand(cmd, getApi, asset)
		usagesCommand(cmd, getApi, asset)
	}

	return cmd
}
