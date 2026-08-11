import type { FigmaClient } from '../client.js'
import type {
	GetDevResourcesResponse,
	PostDevResourcesRequestBody,
	PostDevResourcesResponse,
	PutDevResourcesRequestBody,
	PutDevResourcesResponse,
} from '../figma-types.js'
import type { PaginationSpec } from '../pagination.js'

// Dev resources are developer-contributed links attached to nodes and surfaced
// in Dev Mode. Every endpoint here takes a **main** file key, never a branch
// key, and the two bulk writes answer 200 with a per-item `errors` array — the
// partial-success handling for that lives in api.ts, not here.

/** GET file dev resources returns the whole list at once. */
export const DEV_RESOURCE_LIST_PAGINATION: PaginationSpec = { model: 'none', itemsKey: 'dev_resources' }

export type DevResourceGateway = {
	list: (fileKey: string, opts?: { nodeIds?: string[] }) => Promise<GetDevResourcesResponse>
	create: (body: PostDevResourcesRequestBody) => Promise<PostDevResourcesResponse>
	update: (body: PutDevResourcesRequestBody) => Promise<PutDevResourcesResponse>
	remove: (fileKey: string, devResourceId: string) => Promise<void>
}

export function createFigmaDevResourceGateway(client: FigmaClient): DevResourceGateway {
	return {
		list: (fileKey, opts) =>
			client.request({
				method: 'GET',
				path: `/v1/files/${encodeURIComponent(fileKey)}/dev_resources`,
				// An empty list would read as "no nodes" to Figma rather than "every
				// node", so an unfiltered read sends no node_ids at all.
				query: { node_ids: opts?.nodeIds?.length ? opts.nodeIds : undefined },
			}),
		// Both bulk writes are file-agnostic: the file key travels inside each
		// resource, so one call can span several files.
		create: (body) => client.request({ method: 'POST', path: '/v1/dev_resources', body }),
		update: (body) => client.request({ method: 'PUT', path: '/v1/dev_resources', body }),
		remove: (fileKey, devResourceId) =>
			client.request({
				method: 'DELETE',
				path: `/v1/files/${encodeURIComponent(fileKey)}/dev_resources/${encodeURIComponent(devResourceId)}`,
			}),
	}
}
