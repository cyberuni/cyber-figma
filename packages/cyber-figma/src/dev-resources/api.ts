import type { DevResource } from '../figma-types.js'
import { type DeleteResult, deleteIdempotently } from '../idempotent-delete.js'
import { collectPages, type PaginatedResult, type PaginationOptions } from '../pagination.js'
import { fileKeyFromInput, normalizeNodeId, normalizeNodeIds } from '../url.js'
import { DEV_RESOURCE_LIST_PAGINATION, type DevResourceGateway } from './gateway.js'
import { type DevResourceWriteResult, summarizeWrite } from './write-result.js'

export type DevResourceListOptions = PaginationOptions & {
	/** Comma-separated node ids, in either the URL (`1-2`) or API (`1:2`) form. */
	nodeIds?: string
}

export type DevResourceCreateInput = {
	/** File key or Figma file URL — a **main** file, never a branch. */
	file: string
	nodeId: string
	name: string
	url: string
}

export type DevResourceUpdateInput = {
	id: string
	name?: string
	url?: string
}

export type DevResourceApi = {
	list: (file: string, opts?: DevResourceListOptions) => Promise<PaginatedResult<DevResource>>
	create: (resources: DevResourceCreateInput[]) => Promise<DevResourceWriteResult>
	update: (changes: DevResourceUpdateInput[]) => Promise<DevResourceWriteResult>
	remove: (file: string, devResourceId: string) => Promise<DeleteResult>
}

export function createDevResourceApi(gateway: DevResourceGateway): DevResourceApi {
	return {
		list: (file, opts) =>
			collectPages<DevResource>(
				DEV_RESOURCE_LIST_PAGINATION,
				() =>
					gateway.list(fileKeyFromInput(file), {
						nodeIds: opts?.nodeIds ? normalizeNodeIds(opts.nodeIds) : undefined,
					}),
				opts,
			),
		create: async (resources) => {
			const dev_resources = resources.map((resource) => ({
				name: resource.name,
				url: resource.url,
				file_key: fileKeyFromInput(resource.file),
				node_id: normalizeNodeId(resource.nodeId),
			}))
			const response = await gateway.create({ dev_resources })
			return summarizeWrite('create', dev_resources.length, response.links_created ?? [], response.errors)
		},
		update: async (changes) => {
			const dev_resources = changes.map((change) => ({
				id: change.id,
				...(change.name !== undefined && { name: change.name }),
				...(change.url !== undefined && { url: change.url }),
			}))
			const response = await gateway.update({ dev_resources })
			return summarizeWrite('update', dev_resources.length, response.links_updated ?? [], response.errors)
		},
		remove: (file, devResourceId) =>
			deleteIdempotently('dev resource', devResourceId, () => gateway.remove(fileKeyFromInput(file), devResourceId)),
	}
}
