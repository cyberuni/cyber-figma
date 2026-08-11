import { describe } from 'vitest'
import { FigmaApiError } from '../figma-error.js'
import type { DevResource } from '../figma-types.js'
import { defineListPaginationAcceptanceSpecs } from '../testing/list-pagination.acceptance.js'
import { createDevResourceApi } from './api.js'
import { defineDevResourceAcceptanceSpecs } from './gateway.acceptance.js'
import type { DevResourceGateway } from './gateway.js'

const FILE_KEY = 'main-file-key'
const NODE_ID = '1:2'

/** Figma's documented ceiling per node. */
const MAX_PER_NODE = 10

/**
 * An in-memory stand-in with the documented Dev Resources semantics — including
 * the partial-success behaviour a queued-response double cannot express: both
 * bulk writes answer "200" and report per-item failures in an `errors` array.
 */
function createFakeDevResourceGateway(): DevResourceGateway {
	const stored = new Map<string, DevResource>()
	let nextId = 1

	const onNode = (fileKey: string, nodeId: string) =>
		[...stored.values()].filter((resource) => resource.file_key === fileKey && resource.node_id === nodeId)

	return {
		async list(fileKey, opts) {
			const wanted = opts?.nodeIds
			return {
				dev_resources: [...stored.values()].filter(
					(resource) => resource.file_key === fileKey && (!wanted || wanted.includes(resource.node_id)),
				),
			}
		},
		async create(body) {
			const links_created: DevResource[] = []
			const errors: { file_key?: string | null; node_id?: string | null; error: string }[] = []
			for (const item of body.dev_resources) {
				const siblings = onNode(item.file_key, item.node_id)
				if (item.file_key !== FILE_KEY) {
					errors.push({ file_key: item.file_key, node_id: item.node_id, error: 'File not found' })
				} else if (siblings.length >= MAX_PER_NODE) {
					errors.push({
						file_key: item.file_key,
						node_id: item.node_id,
						error: 'Node already has the maximum of 10 dev resources',
					})
				} else if (siblings.some((sibling) => sibling.url === item.url)) {
					errors.push({
						file_key: item.file_key,
						node_id: item.node_id,
						error: 'Another dev resource on this node has the same url',
					})
				} else {
					const created = { ...item, id: `dr-${nextId++}` }
					stored.set(created.id, created)
					links_created.push(created)
				}
			}
			return { links_created, ...(errors.length > 0 && { errors }) }
		},
		async update(body) {
			const links_updated: DevResource[] = []
			const errors: { id?: string; error: string }[] = []
			for (const item of body.dev_resources) {
				const existing = stored.get(item.id)
				if (!existing) {
					errors.push({ id: item.id, error: 'Dev resource not found' })
					continue
				}
				const updated = { ...existing, ...(item.name && { name: item.name }), ...(item.url && { url: item.url }) }
				stored.set(updated.id, updated)
				links_updated.push(updated)
			}
			return { links_updated, ...(errors.length > 0 && { errors }) }
		},
		async remove(fileKey, devResourceId) {
			const existing = stored.get(devResourceId)
			if (!existing || existing.file_key !== fileKey) {
				throw new FigmaApiError({
					status: 404,
					method: 'DELETE',
					path: `/v1/files/${fileKey}/dev_resources/${devResourceId}`,
				})
			}
			stored.delete(devResourceId)
		},
	}
}

const doubleApi = createDevResourceApi(createFakeDevResourceGateway())

describe(
	'dev resources',
	defineDevResourceAcceptanceSpecs({
		api: () => doubleApi,
		fileKey: FILE_KEY,
		nodeId: NODE_ID,
	}),
)

describe(
	'dev resource list',
	defineListPaginationAcceptanceSpecs({
		model: 'none',
		list: (opts) => createDevResourceApi(createFakeDevResourceGateway()).list(FILE_KEY, opts),
	}),
)
