import type { FigmaClient, FigmaRequest } from '../client.js'
import { createPaginatingClient } from '../testing/paginating-gateway.js'
import { LIBRARY_ANALYTICS_PAGINATION } from './gateway.js'

// The spine's paginating double, adapted to the client interface the gateway
// actually takes. The page it serves is derived from the cursor found *on the
// wire*, so a gateway that forgets to send `cursor` re-requests page one here
// exactly as it would against Figma — which is the failure this double exists
// to catch. Test-only; the bundle entries never reach it.

export function createAnalyticsPagingClient(pages: unknown[][]): FigmaClient & { requests: FigmaRequest[] } {
	const double = createPaginatingClient(LIBRARY_ANALYTICS_PAGINATION, pages)
	return {
		authMode: 'personal',
		requests: double.requests,
		request<T = unknown>(spec: FigmaRequest): Promise<T> {
			const cursor = spec.query?.cursor
			return double.request(spec, { cursor: typeof cursor === 'string' ? cursor : undefined }) as Promise<T>
		},
	}
}
