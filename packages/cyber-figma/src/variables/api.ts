import type {
	LocalVariable,
	LocalVariableCollection,
	PublishedVariable,
	PublishedVariableCollection,
} from '../figma-types.js'
import { collectPages, type PaginatedResult, type PaginationOptions } from '../pagination.js'
import { fileKeyFromInput } from '../url.js'
import { parseVariableChanges, summarizeVariableChanges } from './changes.js'
import { VARIABLE_COLLECTION_LIST_PAGINATION, VARIABLE_LIST_PAGINATION, type VariableGateway } from './gateway.js'

// The operations the CLI and the MCP server share.
//
// Two shapes are reconciled here. Figma returns variables and collections as
// id-keyed maps, which no other list endpoint in this API does — every entry
// already carries its own `id`, so the map adds nothing a caller can use and
// costs them an Object.values before they can render or filter anything. And
// both read endpoints answer with variables *and* collections in one payload,
// so `list` and `collections` are two views of one response, not two requests.

export type VariableView = { published?: boolean }

export type VariableListOptions = PaginationOptions &
	VariableView & {
		/** Keep only the variables in this collection. Figma has no server-side filter for it. */
		collectionId?: string
	}

export type VariableApplyResult = {
	/** The real ids Figma assigned to the temporary ids in the change set. */
	temp_id_to_real_id: Record<string, string>
	/** How many objects the change set touched, per array. */
	changes: Record<string, number>
	note: string
}

export type VariableApi = {
	list: (file: string, opts?: VariableListOptions) => Promise<PaginatedResult<LocalVariable | PublishedVariable>>
	collections: (
		file: string,
		opts?: PaginationOptions & VariableView,
	) => Promise<PaginatedResult<LocalVariableCollection | PublishedVariableCollection>>
	get: (file: string, variableId: string, opts?: VariableView) => Promise<LocalVariable | PublishedVariable>
	apply: (file: string, changes: unknown) => Promise<VariableApplyResult>
	/** Check a change set without sending it. Throws the same report `apply` would. */
	validate: (changes: unknown) => VariableValidateResult
}

export type VariableValidateResult = {
	valid: true
	changes: Record<string, number>
	note: string
}

/** Figma's REST API has no publish operation, so a written change stops in the file it was written to. */
const PUBLISH_NOTE =
	'Variables changed through the API are visible only in this file until the library is published. Publishing is a Figma UI action — the REST API does not expose it.'

type VariablesPayload = {
	variables: Record<string, LocalVariable | PublishedVariable>
	variableCollections: Record<string, LocalVariableCollection | PublishedVariableCollection>
}

function isInCollection(variable: LocalVariable | PublishedVariable, collectionId: string | undefined): boolean {
	return collectionId === undefined || variable.variableCollectionId === collectionId
}

export function createVariableApi(gateway: VariableGateway): VariableApi {
	// Both endpoints return the same two members; which one to call is the only
	// difference between the local and the published view.
	const read = async (file: string, opts: VariableView | undefined): Promise<VariablesPayload> => {
		const fileKey = fileKeyFromInput(file)
		return (opts?.published ? gateway.published(fileKey) : gateway.local(fileKey)) as Promise<VariablesPayload>
	}

	return {
		list: (file, opts) =>
			collectPages<LocalVariable | PublishedVariable>(
				VARIABLE_LIST_PAGINATION,
				async () => {
					const payload = await read(file, opts)
					return { variables: Object.values(payload.variables).filter((v) => isInCollection(v, opts?.collectionId)) }
				},
				opts,
			),

		collections: (file, opts) =>
			collectPages<LocalVariableCollection | PublishedVariableCollection>(
				VARIABLE_COLLECTION_LIST_PAGINATION,
				async () => ({ variableCollections: Object.values((await read(file, opts)).variableCollections) }),
				opts,
			),

		get: async (file, variableId, opts) => {
			// Figma has no by-id variable endpoint: resolving the `variableId` a node
			// carries in `boundVariables` means reading the file's variables and
			// looking it up. One request either way.
			const payload = await read(file, opts)
			const variable = payload.variables[variableId]
			if (!variable) {
				throw Object.assign(new Error(`No variable ${variableId} in file ${fileKeyFromInput(file)}`), {
					hint: `List the variables in the file to see the ids it does have: cyber-figma variable list ${file}${opts?.published ? ' --published' : ''}. A boundVariables id from GET file is a local id; look it up without --published.`,
				})
			}
			return variable
		},

		// Worth its own operation because the endpoint behind `apply` is Enterprise-
		// only and seat-gated: a caller who cannot reach it at all can still be told
		// whether the change set they are about to hand off is well formed.
		validate: (changes) => ({
			valid: true,
			changes: summarizeVariableChanges(parseVariableChanges(changes)),
			note: PUBLISH_NOTE,
		}),

		apply: async (file, changes) => {
			// Validated before the request: the endpoint is Enterprise-only and
			// seat-gated, so a round trip to learn the body was malformed is one most
			// callers cannot even make.
			const body = parseVariableChanges(changes)
			const result = await gateway.apply(fileKeyFromInput(file), body)
			return {
				temp_id_to_real_id: result.tempIdToRealId ?? {},
				changes: summarizeVariableChanges(body),
				note: PUBLISH_NOTE,
			}
		},
	}
}
