import type { DeveloperLog } from '../figma-types.js'
import type { PaginatedResult, PaginationOptions } from '../pagination.js'
import type {
	DeveloperLogDateRange,
	DeveloperLogEventSource,
	DeveloperLogGateway,
	DeveloperLogTokenType,
} from './gateway.js'

// The operations the CLI and MCP both call. Every filter Figma types as an enum
// is checked here, because the endpoint is reachable only with a plan access
// token an org admin had to mint — spending that round trip to learn a value was
// misspelled is the expensive way to find out.

export type DeveloperLogListOptions = PaginationOptions & {
	tokenType?: string
	/** A token *value* prefix. It is a credential; prefer tokenName where you can. */
	token?: string
	tokenName?: string
	userEmail?: string
	ipAddress?: string
	eventSource?: string
	dateRange?: string
}

export type DeveloperLogApi = {
	list: (opts: DeveloperLogListOptions) => Promise<PaginatedResult<DeveloperLog>>
}

export const DEVELOPER_LOG_TOKEN_TYPES: DeveloperLogTokenType[] = [
	'plan_access_token',
	'developer_token',
	'oauth_token',
]
export const DEVELOPER_LOG_EVENT_SOURCES: DeveloperLogEventSource[] = ['rest_api', 'mcp_server']
export const DEVELOPER_LOG_DATE_RANGES: DeveloperLogDateRange[] = ['last_24h', 'last_7d', 'last_30d']

function oneOf<T extends string>(label: string, choices: T[], value: string | undefined, note = ''): T | undefined {
	if (value === undefined) return undefined
	if (!choices.includes(value as T)) {
		throw new Error(`${label} must be one of ${choices.join(', ')} — not "${value}".${note}`)
	}
	return value as T
}

export function createDeveloperLogApi(gateway: DeveloperLogGateway): DeveloperLogApi {
	return {
		// `async` so a validation failure arrives as a rejection like any API failure.
		async list(opts) {
			return gateway.list(
				{
					tokenType: oneOf('token_type', DEVELOPER_LOG_TOKEN_TYPES, opts.tokenType),
					token: opts.token,
					tokenName: opts.tokenName,
					userEmail: opts.userEmail,
					ipAddress: opts.ipAddress,
					eventSource: oneOf('event_source', DEVELOPER_LOG_EVENT_SOURCES, opts.eventSource),
					dateRange: oneOf(
						'date_range',
						DEVELOPER_LOG_DATE_RANGES,
						opts.dateRange,
						' Figma retains developer logs for 30 days only, so no longer range exists.',
					),
				},
				opts,
			)
		},
	}
}
