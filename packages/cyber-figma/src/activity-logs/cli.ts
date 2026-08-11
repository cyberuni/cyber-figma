import { Command, Option } from 'commander'
import { parsePageSize } from '../cli-options.js'
import { output, printCountSummary, printNextSteps, printSummary, printTable } from '../output.js'
import { isFull, truncate } from '../truncate.js'
import type { ActivityLogApi } from './api.js'
import type { ActivityLogResult } from './gateway.js'

type ListCliOptions = {
	events?: string
	startTime?: string
	endTime?: string
	limit?: number
	order?: string
}

function entityLabel(entity: unknown): string {
	const value = (entity ?? {}) as Record<string, unknown>
	const name = value.name ?? value.key ?? value.id ?? ''
	return `${value.type ?? 'unknown'}${name ? ` ${name}` : ''}`
}

function actorLabel(actor: unknown): string {
	const value = (actor ?? {}) as Record<string, unknown>
	return String(value.name ?? value.email ?? value.id ?? 'system')
}

export function activityLogCommand(getApi: () => ActivityLogApi): Command {
	const cmd = new Command('activity-log').description(
		'Organization activity log (audit trail). Enterprise plan, org admins only — and it cannot be read with a personal access token: authenticate with org OAuth (scope org:activity_log_read) or a plan access token, via --auth-mode oauth / --auth-mode plan.',
	)

	cmd
		.command('list')
		.description('List organization activity events in a time window')
		.option('--events <types>', 'Comma-separated event types (all events by default)')
		.option(
			'--start-time <time>',
			'Least recent event: Unix seconds, an ISO 8601 instant, or YYYY-MM-DD (default: one year ago)',
		)
		.option('--end-time <time>', 'Most recent event, same formats (default: now)')
		.option('--limit <number>', 'Maximum events to return (Figma default: 1000)', parsePageSize)
		.addOption(new Option('--order <direction>', 'Order by timestamp').choices(['asc', 'desc']))
		.action(async (opts: ListCliOptions) => {
			const result: ActivityLogResult = await getApi().list(opts)

			output(result, () => {
				printTable(
					result.data,
					[
						{ label: 'timestamp', get: (log) => new Date(log.timestamp * 1000).toISOString() },
						{ label: 'action', get: (log) => log.action.type },
						{ label: 'actor', get: (log) => truncate(actorLabel(log.actor), { limit: 40, full: isFull() }) },
						{ label: 'entity', get: (log) => truncate(entityLabel(log.entity), { limit: 60, full: isFull() }) },
					],
					{ entity: 'activity events' },
				)
				printCountSummary(result.count, 'activity event(s)')
				if (result.has_more) {
					// There is no cursor to offer: the only documented way forward is a
					// narrower window, so say that instead of implying a next page.
					printSummary(
						'\nMore events matched this window than were returned. Figma documents no cursor parameter for this endpoint — narrow it with --start-time/--end-time, or walk it with --order desc and a moving --end-time.',
					)
				}
				printNextSteps([
					'cyber-figma activity-log list --start-time 2026-01-01 --end-time 2026-02-01 --order desc',
					'cyber-figma activity-log list --events file.create --json',
				])
			})
		})

	return cmd
}
