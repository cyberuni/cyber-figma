import { describe } from 'vitest'
import { createRuntimeContext } from '../composition.js'
import { isSystemTestEnabled, requireSystemEnv, systemEnv } from '../testing/system.js'
import type { DevResourceApi } from './api.js'
import { defineDevResourceAcceptanceSpecs } from './gateway.acceptance.js'

// The same acceptance factory the doubles run, against the live API.
//
// FIGMA_DEV_RESOURCE_FILE_KEY must be a MAIN file key — these endpoints reject
// a branch key. FIGMA_DEV_RESOURCE_NODE_ID is optional: without it only the
// read contract runs, so a token with no edit access still passes. With it, the
// suite creates links on that node and deletes them again.
const enabled = isSystemTestEnabled() && Boolean(systemEnv('FIGMA_DEV_RESOURCE_FILE_KEY'))

// Built on first use: a skipped suite is still collected, and building the
// context eagerly would demand a credential nobody configured.
let context: ReturnType<typeof createRuntimeContext> | undefined
function liveApi(): DevResourceApi {
	context ??= createRuntimeContext()
	return context.api<DevResourceApi>('dev-resource')
}

describe.skipIf(!enabled)('dev resources (live)', () => {
	describe(
		'contract',
		defineDevResourceAcceptanceSpecs({
			api: () => liveApi(),
			fileKey: enabled ? requireSystemEnv('FIGMA_DEV_RESOURCE_FILE_KEY') : '',
			nodeId: systemEnv('FIGMA_DEV_RESOURCE_NODE_ID'),
		}),
	)
})
