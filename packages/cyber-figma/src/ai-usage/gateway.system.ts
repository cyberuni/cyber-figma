import { describe } from 'vitest'
import { createRuntimeContext } from '../composition.js'
import { isSystemTestEnabled, systemEnv } from '../testing/system.js'
import type { AiUsageApi } from './api.js'
import { defineAiUsageAcceptanceSpecs } from './gateway.acceptance.js'
import { aiUsageDomain } from './index.js'

// AI Usage needs an Enterprise plan, an org admin, and a **plan access token** —
// no other credential can reach it. Opt in with FIGMA_AI_USAGE_SYSTEM_TEST plus
// FIGMA_AUTH_MODE=plan, and optionally FIGMA_AI_USAGE_START_DATE /
// FIGMA_AI_USAGE_END_DATE to point at a window the plan has data in. Unset, this
// skips, which is the ordinary case.
const enabled = isSystemTestEnabled() && Boolean(systemEnv('FIGMA_AI_USAGE_SYSTEM_TEST'))

// Built on first call, not at collection time: a skipped suite is still
// collected, and creating the runtime context demands a credential.
let resolved: AiUsageApi | undefined
const lazyApi: AiUsageApi = {
	daily: (opts) => {
		resolved ??= createRuntimeContext({ domains: [aiUsageDomain] }).api<AiUsageApi>('ai-usage')
		return resolved.daily(opts)
	},
}

describe.skipIf(!enabled)(
	'ai usage (live)',
	defineAiUsageAcceptanceSpecs({
		api: lazyApi,
		startDate: systemEnv('FIGMA_AI_USAGE_START_DATE') ?? '2025-12-01',
		endDate: systemEnv('FIGMA_AI_USAGE_END_DATE') ?? '2025-12-31',
		// A plan's usage rarely fills a 1000-row page, so the multi-page walk
		// cannot be guaranteed against a live plan.
		includeMultiPage: false,
	}),
)
