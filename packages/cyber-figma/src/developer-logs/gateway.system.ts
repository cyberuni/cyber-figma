import { describe } from 'vitest'
import { createRuntimeContext } from '../composition.js'
import { isSystemTestEnabled, systemEnv } from '../testing/system.js'
import type { DeveloperLogApi } from './api.js'
import { defineDeveloperLogAcceptanceSpecs } from './gateway.acceptance.js'
import { developerLogDomain } from './index.js'

// Developer Logs needs an Enterprise plan with the Governance+ add-on, an org
// admin, and a **plan access token** — no other credential can reach it. Opt in
// with FIGMA_DEVELOPER_LOGS_SYSTEM_TEST plus FIGMA_AUTH_MODE=plan; unset, this
// skips, which is the ordinary case.
const enabled = isSystemTestEnabled() && Boolean(systemEnv('FIGMA_DEVELOPER_LOGS_SYSTEM_TEST'))

// Built on first call, not at collection time: a skipped suite is still
// collected, and creating the runtime context demands a credential.
let resolved: DeveloperLogApi | undefined
const lazyApi: DeveloperLogApi = {
	list: (opts) => {
		resolved ??= createRuntimeContext({ domains: [developerLogDomain] }).api<DeveloperLogApi>('developer-log')
		return resolved.list(opts)
	},
}

describe.skipIf(!enabled)(
	'developer logs (live)',
	defineDeveloperLogAcceptanceSpecs({
		api: lazyApi,
		// A quiet org may have fewer entries than one page, so the multi-page walk
		// cannot be guaranteed against a live plan.
		includeMultiPage: false,
	}),
)
