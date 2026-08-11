import type { FigmaClient, FigmaRequest } from '../client.js'
import { createPaginatingClient } from '../testing/paginating-gateway.js'
import { DEVELOPER_LOG_PAGINATION } from './gateway.js'

// The spine's paginating double, adapted to the client the gateway takes. The
// page it serves comes from the cursor found **in the request body**, which is
// where this endpoint alone reads it — so a gateway that puts the cursor in the
// query string re-requests page one here exactly as it would against Figma.

export function createDeveloperLogPagingClient(pages: unknown[][]): FigmaClient & { requests: FigmaRequest[] } {
	const double = createPaginatingClient(DEVELOPER_LOG_PAGINATION, pages)
	return {
		authMode: 'plan',
		requests: double.requests,
		request<T = unknown>(spec: FigmaRequest): Promise<T> {
			const cursor = (spec.body as { cursor?: unknown } | undefined)?.cursor
			return double.request(spec, { cursor: typeof cursor === 'string' ? cursor : undefined }) as Promise<T>
		},
	}
}
