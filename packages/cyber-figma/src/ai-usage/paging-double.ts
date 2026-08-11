import type { FigmaClient, FigmaRequest } from '../client.js'
import { createPaginatingClient } from '../testing/paginating-gateway.js'
import { AI_USAGE_PAGINATION } from './gateway.js'

// The spine's paginating double, adapted to the client the gateway takes. The
// page it serves comes from the cursor found on the wire, so a gateway that
// forgets to send `cursor` re-requests page one here exactly as it would
// against Figma.

export function createAiUsagePagingClient(pages: unknown[][]): FigmaClient & { requests: FigmaRequest[] } {
	const double = createPaginatingClient(AI_USAGE_PAGINATION, pages)
	return {
		authMode: 'plan',
		requests: double.requests,
		request<T = unknown>(spec: FigmaRequest): Promise<T> {
			const cursor = spec.query?.cursor
			return double.request(spec, { cursor: typeof cursor === 'string' ? cursor : undefined }) as Promise<T>
		},
	}
}
