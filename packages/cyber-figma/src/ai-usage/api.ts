import type { AiUsageDailyRow } from '../figma-types.js'
import type { PaginatedResult, PaginationOptions } from '../pagination.js'
import type { AiUsageGateway } from './gateway.js'

// The operations the CLI and MCP both call. The date window is required and
// bounded on both ends, and the credential that can reach this endpoint at all
// is a plan access token an org admin had to mint — so every rule Figma states
// is checked here rather than paid for in a round trip.

/** The first day Figma has AI usage data for. Anything earlier is a 400. */
export const AI_USAGE_FIRST_DAY = '2025-12-01'

export type AiUsageDailyOptions = PaginationOptions & {
	startDate: string
	endDate: string
	userEmail?: string
}

export type AiUsageApi = {
	daily: (opts: AiUsageDailyOptions) => Promise<PaginatedResult<AiUsageDailyRow>>
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function requireDate(label: string, value: string | undefined): string {
	if (!value) throw new Error(`${label} is required: Figma takes an explicit ${label} in YYYY-MM-DD form (UTC).`)
	if (!ISO_DATE.test(value)) {
		throw new Error(`${label} must be a UTC calendar date in YYYY-MM-DD form, not "${value}".`)
	}
	return value
}

export function createAiUsageApi(gateway: AiUsageGateway): AiUsageApi {
	return {
		// `async` so a validation failure arrives as a rejection like any API failure.
		async daily(opts) {
			const startDate = requireDate('start_date', opts.startDate)
			const endDate = requireDate('end_date', opts.endDate)

			// Both bounds are lexicographically comparable in this format, so no date
			// parsing — and no timezone — is involved in either check.
			if (startDate < AI_USAGE_FIRST_DAY) {
				throw new Error(
					`start_date must be on or after ${AI_USAGE_FIRST_DAY}: Figma has no AI usage data before that day.`,
				)
			}
			if (endDate < startDate) {
				throw new Error(`end_date (${endDate}) is before start_date (${startDate}); the window would match nothing.`)
			}

			return gateway.daily({ startDate, endDate, userEmail: opts.userEmail }, opts)
		},
	}
}
