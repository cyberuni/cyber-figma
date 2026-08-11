import { describe } from 'vitest'
import { createRuntimeContext } from '../composition.js'
import { isSystemTestEnabled, systemEnv } from '../testing/system.js'
import type { AnalyticsApi } from './api.js'
import { defineAnalyticsAcceptanceSpecs } from './gateway.acceptance.js'
import { analyticsDomain } from './index.js'

// The same acceptance specs the unit suite runs against doubles, against the
// live API. Library Analytics is Enterprise-only and reports on *published
// library* files, so this needs both an Enterprise credential and the key of a
// library — FIGMA_ANALYTICS_LIBRARY_FILE_KEY. Without it the suite skips, which
// is the normal case: most contributors cannot run this at all.

const libraryFileKey = systemEnv('FIGMA_ANALYTICS_LIBRARY_FILE_KEY')
const enabled = isSystemTestEnabled() && Boolean(libraryFileKey)

// Built on first call, not at collection time: a skipped suite is still
// collected, and creating the runtime context demands a credential.
let resolved: AnalyticsApi | undefined
function api(): AnalyticsApi {
	resolved ??= createRuntimeContext({ domains: [analyticsDomain] }).api<AnalyticsApi>('analytics')
	return resolved
}

const lazyApi: AnalyticsApi = {
	actions: (asset, file, opts) => api().actions(asset, file, opts),
	usages: (asset, file, opts) => api().usages(asset, file, opts),
}

describe.skipIf(!enabled)(
	'library analytics (live)',
	defineAnalyticsAcceptanceSpecs({
		api: lazyApi,
		fileKey: libraryFileKey ?? '',
		// A real library rarely has more than one page of rows, and Figma decides
		// the page size, so the multi-page walk cannot be guaranteed here.
		includeMultiPage: false,
	}),
)
