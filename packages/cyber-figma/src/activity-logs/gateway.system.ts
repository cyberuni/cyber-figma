import { describe } from 'vitest'
import { createRuntimeContext } from '../composition.js'
import { isSystemTestEnabled, systemEnv } from '../testing/system.js'
import type { ActivityLogApi } from './api.js'
import { defineActivityLogAcceptanceSpecs } from './gateway.acceptance.js'
import { activityLogDomain } from './index.js'

// Activity Logs is Enterprise-only, org-admin-only, and unreachable with a
// personal access token — so this suite needs FIGMA_ACTIVITY_LOGS_SYSTEM_TEST
// set deliberately, alongside FIGMA_AUTH_MODE=plan (or oauth) and a credential
// of that kind. Unset, it skips: the ordinary case for every contributor
// without an Enterprise org.
const enabled = isSystemTestEnabled() && Boolean(systemEnv('FIGMA_ACTIVITY_LOGS_SYSTEM_TEST'))

// Built on first call, not at collection time: a skipped suite is still
// collected, and creating the runtime context demands a credential.
let resolved: ActivityLogApi | undefined
const lazyApi: ActivityLogApi = {
	list: (opts) => {
		resolved ??= createRuntimeContext({ domains: [activityLogDomain] }).api<ActivityLogApi>('activity-log')
		return resolved.list(opts)
	},
}

describe.skipIf(!enabled)('activity logs (live)', defineActivityLogAcceptanceSpecs({ api: lazyApi }))
