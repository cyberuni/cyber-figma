import type { FigmaClient } from '../client.js'
import type {
	GetLocalVariablesResponse,
	GetPublishedVariablesResponse,
	PostVariablesRequestBody,
	PostVariablesResponse,
} from '../figma-types.js'
import type { PaginationSpec } from '../pagination.js'

// Variables are Enterprise-gated on read as well as write. Nothing here catches
// that: the spine maps a 401/403 on these paths to the plan requirement and
// exit code 7 (see figma-error.ts → PLAN_GATES), which is exactly why this
// gateway must use the documented paths verbatim.

/** All three Variables endpoints answer with the whole payload at once. */
export const VARIABLE_LIST_PAGINATION: PaginationSpec = { model: 'none', itemsKey: 'variables' }

/** The collections half of the same response, listed under its own key. */
export const VARIABLE_COLLECTION_LIST_PAGINATION: PaginationSpec = {
	model: 'none',
	itemsKey: 'variableCollections',
}

export type LocalVariablesPayload = GetLocalVariablesResponse['meta']
export type PublishedVariablesPayload = GetPublishedVariablesResponse['meta']
export type VariableChangeResult = PostVariablesResponse['meta']

export type VariableGateway = {
	/** Variables created in the file plus the remote ones it uses. The only place mode values are readable. */
	local: (fileKey: string) => Promise<LocalVariablesPayload>
	/** Published library variables. Requires a **main** file key — branches cannot publish. */
	published: (fileKey: string) => Promise<PublishedVariablesPayload>
	/** The bulk create/update/delete endpoint. Arrays are applied in the order the body lists them. */
	apply: (fileKey: string, changes: PostVariablesRequestBody) => Promise<VariableChangeResult>
}

export function createFigmaVariableGateway(client: FigmaClient): VariableGateway {
	return {
		local: (fileKey) =>
			client.request({
				method: 'GET',
				path: `/v1/files/${encodeURIComponent(fileKey)}/variables/local`,
				unwrap: 'meta',
			}),
		published: (fileKey) =>
			client.request({
				method: 'GET',
				path: `/v1/files/${encodeURIComponent(fileKey)}/variables/published`,
				unwrap: 'meta',
			}),
		apply: (fileKey, changes) =>
			client.request({
				method: 'POST',
				path: `/v1/files/${encodeURIComponent(fileKey)}/variables`,
				body: changes,
				unwrap: 'meta',
			}),
	}
}
