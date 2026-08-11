import { describe } from 'vitest'
import { createRuntimeContext } from '../composition.js'
import { isSystemTestEnabled, systemEnv } from '../testing/system.js'
import type { DiscoveryApi } from './api.js'
import { defineDiscoveryAcceptanceSpecs } from './gateway.acceptance.js'
import { discoveryDomain } from './index.js'

// Discovery needs an Enterprise plan with the Governance+ add-on, an org admin,
// and an **OAuth 2** credential — no personal or plan access token can reach it.
// Opt in with FIGMA_DISCOVERY_SYSTEM_TEST plus FIGMA_AUTH_MODE=oauth. Unset,
// this skips, which is the ordinary case.
const enabled = isSystemTestEnabled() && Boolean(systemEnv('FIGMA_DISCOVERY_SYSTEM_TEST'))

// Built on first call, not at collection time: a skipped suite is still
// collected, and creating the runtime context demands a credential.
let resolved: DiscoveryApi | undefined
const lazyApi: DiscoveryApi = {
	textEvents: (opts) => {
		resolved ??= createRuntimeContext({ domains: [discoveryDomain] }).api<DiscoveryApi>('discovery')
		return resolved.textEvents(opts)
	},
}

// A window that is safely in the past for any run: yesterday, two hours wide.
const startDate = systemEnv('FIGMA_DISCOVERY_START_DATE') ?? isoHoursAgo(26)
const endDate = systemEnv('FIGMA_DISCOVERY_END_DATE') ?? isoHoursAgo(24)

function isoHoursAgo(hours: number): string {
	const at = new Date(Date.now() - hours * 60 * 60 * 1000)
	at.setUTCMinutes(0, 0, 0)
	return at.toISOString()
}

describe.skipIf(!enabled)('discovery (live)', defineDiscoveryAcceptanceSpecs({ api: lazyApi, startDate, endDate }))
