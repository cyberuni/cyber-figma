import { describe } from 'vitest'
import { createRuntimeContext } from '../composition.js'
import { isSystemTestEnabled, systemEnv } from '../testing/system.js'
import type { PaymentApi } from './api.js'
import { definePaymentAcceptanceSpecs } from './gateway.acceptance.js'
import { paymentDomain } from './index.js'

// Payments carries no plan gate, but you can only query a resource you **own**,
// with a **personal access token** — so this suite needs the ids of a plugin you
// published and a user to ask about: FIGMA_PAYMENTS_PLUGIN_ID and
// FIGMA_PAYMENTS_USER_ID. Unset, it skips.
const pluginId = systemEnv('FIGMA_PAYMENTS_PLUGIN_ID')
const userId = systemEnv('FIGMA_PAYMENTS_USER_ID')
const enabled = isSystemTestEnabled() && Boolean(pluginId && userId)

// Built on first call, not at collection time: a skipped suite is still
// collected, and creating the runtime context demands a credential.
let resolved: PaymentApi | undefined
const lazyApi: PaymentApi = {
	get: (opts) => {
		resolved ??= createRuntimeContext({ domains: [paymentDomain] }).api<PaymentApi>('payment')
		return resolved.get(opts)
	},
}

describe.skipIf(!enabled)(
	'payments (live)',
	definePaymentAcceptanceSpecs({ api: lazyApi, userId: userId ?? '', pluginId: pluginId ?? '' }),
)
