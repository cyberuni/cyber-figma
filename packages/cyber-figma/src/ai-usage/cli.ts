import { Command } from 'commander'
import {
	addPaginationOptions,
	type PaginationCliOptions,
	paginationOptionsFromCli,
	printNextPageHint,
} from '../cli-options.js'
import { output, printCountSummary, printNextSteps, printSummary, printTable } from '../output.js'
import { isFull, truncate } from '../truncate.js'
import type { AiUsageApi } from './api.js'
import { AI_USAGE_PAGINATION } from './gateway.js'

type DailyCliOptions = PaginationCliOptions & {
	startDate: string
	endDate: string
	userEmail?: string
}

export function aiUsageCommand(getApi: () => AiUsageApi): Command {
	const cmd = new Command('ai-usage').description(
		'Organization AI credit usage. Requires an Enterprise plan and an org admin, and is reachable with a plan access token only (--auth-mode plan, scope org:ai_metering_usage_read). Data lags real time by 5–6 hours, so the current day is always incomplete.',
	)

	addPaginationOptions(
		cmd
			.command('daily')
			.description('Per-user, per-day AI credit aggregates over a date window')
			.requiredOption('--start-date <YYYY-MM-DD>', 'First day to include, inclusive (UTC). No earlier than 2025-12-01')
			.requiredOption('--end-date <YYYY-MM-DD>', 'Last day to include, inclusive (UTC). Today or earlier')
			.option(
				'--user-email <email>',
				'Restrict to one user. An address matching no Figma user is an error, not an empty result',
			)
			.action(async (opts: DailyCliOptions) => {
				const result = await getApi().daily({
					startDate: opts.startDate,
					endDate: opts.endDate,
					userEmail: opts.userEmail,
					...paginationOptionsFromCli(opts),
				})

				output(result, () => {
					printTable(
						result.data,
						[
							{ label: 'day', get: (row) => row.day },
							{ label: 'user', get: (row) => truncate(row.user_email ?? row.user_id, { limit: 40, full: isFull() }) },
							{ label: 'editor', get: (row) => row.editor_type },
							{ label: 'seat credits', get: (row) => String(row.seat_credits_sum) },
							{ label: 'plan credits', get: (row) => String(row.plan_credits_sum) },
						],
						{ entity: 'AI usage rows' },
					)
					printCountSummary(result.count, 'AI usage row(s)')
					if (result.count > 0) {
						const seat = result.data.reduce((total, row) => total + row.seat_credits_sum, 0)
						const plan = result.data.reduce((total, row) => total + row.plan_credits_sum, 0)
						printSummary(`${seat} seat credit(s) and ${plan} plan credit(s) over the rows shown`)
					}
					printNextPageHint(
						result,
						`cyber-figma ai-usage daily --start-date ${opts.startDate} --end-date ${opts.endDate}`,
					)
					printNextSteps([
						`cyber-figma ai-usage daily --start-date ${opts.startDate} --end-date ${opts.endDate} --user-email <email>`,
					])
				})
			}),
		AI_USAGE_PAGINATION,
	)

	return cmd
}
