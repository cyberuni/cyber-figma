import { randomUUID } from 'node:crypto'
import { describe } from 'vitest'
import { createRuntimeContext } from '../composition.js'
import { defineListPaginationAcceptanceSpecs } from '../testing/list-pagination.acceptance.js'
import { isSystemTestEnabled, systemEnv } from '../testing/system.js'
import type { WebhookApi } from './api.js'
import { defineWebhookAcceptanceSpecs } from './gateway.acceptance.js'

// The same contract the double is held to, against the live API.
//
// Reads run on FIGMA_TEAM_ID alone. The lifecycle spec is opt-in on
// FIGMA_WEBHOOK_SYSTEM_ENDPOINT, because it creates a real webhook on a real
// team — it creates it PAUSED so nothing is ever delivered to that URL, and
// deletes it in a finally block.
const api = () => createRuntimeContext().api<WebhookApi>('webhook')

const endpoint = systemEnv('FIGMA_WEBHOOK_SYSTEM_ENDPOINT')
const planApiId = systemEnv('FIGMA_WEBHOOK_SYSTEM_PLAN_API_ID')

describe.skipIf(!isSystemTestEnabled())('webhook domain (live)', () => {
	describe(
		'against the Figma API',
		defineWebhookAcceptanceSpecs({
			get api() {
				return api()
			},
			list: () => api().list(),
			...(endpoint && {
				write: {
					context: 'team' as const,
					endpoint,
					// A throwaway secret: the webhook is paused and deleted, and the
					// passcode is masked on every path out of the api anyway.
					passcode: randomUUID(),
				},
			}),
		}),
	)

	// The paginated form of the endpoint, which only the plan query reaches. An
	// account is unlikely to hold two pages of webhooks, so the multi-page specs
	// are left off rather than asserted and skipped for the wrong reason.
	describe.skipIf(!planApiId)(
		'webhook list pagination (live)',
		defineListPaginationAcceptanceSpecs({
			model: 'url_cursor',
			includeMultiPage: false,
			list: (opts) => api().list({ plan: planApiId, ...opts }),
		}),
	)
})
