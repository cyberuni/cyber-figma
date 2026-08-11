import { Command, Option } from 'commander'
import {
	addPaginationOptions,
	type PaginationCliOptions,
	paginationOptionsFromCli,
	printNextPageHint,
} from '../cli-options.js'
import { output, printCountSummary, printNextSteps, printTable } from '../output.js'
import { isFull, truncate } from '../truncate.js'
import {
	DEVELOPER_LOG_DATE_RANGES,
	DEVELOPER_LOG_EVENT_SOURCES,
	DEVELOPER_LOG_TOKEN_TYPES,
	type DeveloperLogApi,
} from './api.js'
import { DEVELOPER_LOG_PAGINATION } from './gateway.js'

type ListCliOptions = PaginationCliOptions & {
	tokenType?: string
	filterToken?: string
	tokenName?: string
	userEmail?: string
	ipAddress?: string
	eventSource?: string
	dateRange?: string
}

export function developerLogCommand(getApi: () => DeveloperLogApi): Command {
	const cmd = new Command('developer-log').description(
		'Organization developer logs — every REST API and MCP server request made against this org. Requires an Enterprise plan with the Governance+ add-on and an org admin, and is reachable with a plan access token only (--auth-mode plan, scope org:developer_log_read). Records are retained 30 days.',
	)

	addPaginationOptions(
		cmd
			.command('list')
			.description('List developer log entries')
			.addOption(
				new Option('--token-type <type>', 'Filter by the kind of credential used').choices(DEVELOPER_LOG_TOKEN_TYPES),
			)
			// Not `--token`: that is the global credential flag. This one filters by
			// the token value recorded in the log, and putting a secret on a command
			// line is worth avoiding — prefer --token-name.
			.option(
				'--filter-token <prefix>',
				'Filter by token value prefix (comma-separated). A secret: prefer --token-name',
			)
			.option('--token-name <prefix>', 'Filter by token name prefix (comma-separated)')
			.option('--user-email <prefix>', 'Filter by user email prefix (comma-separated)')
			.option('--ip-address <prefix>', 'Filter by IP address prefix (comma-separated)')
			.addOption(
				new Option('--event-source <source>', 'Filter by what made the call').choices(DEVELOPER_LOG_EVENT_SOURCES),
			)
			.addOption(
				new Option('--date-range <range>', 'Window to search (30-day retention)').choices(DEVELOPER_LOG_DATE_RANGES),
			)
			.action(async (opts: ListCliOptions) => {
				const result = await getApi().list({
					tokenType: opts.tokenType,
					token: opts.filterToken,
					tokenName: opts.tokenName,
					userEmail: opts.userEmail,
					ipAddress: opts.ipAddress,
					eventSource: opts.eventSource,
					dateRange: opts.dateRange,
					...paginationOptionsFromCli(opts),
				})

				output(result, () => {
					printTable(
						result.data,
						[
							{ label: 'timestamp', get: (entry) => entry.timestamp },
							{ label: 'event', get: (entry) => truncate(entry.action.event_name, { limit: 50, full: isFull() }) },
							{ label: 'actor', get: (entry) => truncate(actorLabel(entry.actor), { limit: 40, full: isFull() }) },
							{ label: 'source', get: (entry) => entry.action.event_source },
							{
								label: 'resource',
								get: (entry) => truncate(resourceLabel(entry.resource), { limit: 40, full: isFull() }),
							},
						],
						{ entity: 'developer log entries' },
					)
					printCountSummary(result.count, 'developer log entr(ies)')
					printNextPageHint(result, 'cyber-figma developer-log list')
					printNextSteps([
						'cyber-figma developer-log list --event-source mcp_server --date-range last_7d',
						'cyber-figma developer-log list --user-email dev@example.com --json',
					])
				})
			}),
		DEVELOPER_LOG_PAGINATION,
	)

	return cmd
}

function actorLabel(actor: unknown): string {
	const value = (actor ?? {}) as Record<string, unknown>
	// Plan-token calls have no user at all, which is the point of the token name.
	return String(value.user_email ?? value.token_name ?? value.user_id ?? 'unknown')
}

function resourceLabel(resource: unknown): string {
	const value = (resource ?? {}) as Record<string, unknown>
	// Null throughout for calls with no resource — activity logs, for one.
	return String(value.name ?? value.id_or_key ?? '')
}
