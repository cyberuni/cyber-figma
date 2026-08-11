import type { DevResource } from '../figma-types.js'

// The Dev Resources trap. `POST` and `PUT /v1/dev_resources` are bulk writes
// that answer HTTP 200 while carrying a per-item `errors` array: a 2xx is not
// proof of success. Every write goes through here so the caller is told how
// many of the items it asked for actually landed — and so a write where nothing
// landed fails loudly instead of reading as done.

export type DevResourceWriteAction = 'create' | 'update'

/** One item Figma refused. `file_key`/`node_id` come back from a create, `id` from an update. */
export type DevResourceWriteError = {
	file_key?: string | null
	node_id?: string | null
	id?: string
	error: string
}

export type DevResourceWriteResult = {
	/** True only when Figma reported no per-item error at all. */
	ok: boolean
	action: DevResourceWriteAction
	requested: number
	succeeded: number
	failed: number
	dev_resources: DevResource[]
	errors: DevResourceWriteError[]
}

const HINT = [
	'POST/PUT /v1/dev_resources answer 200 even when items fail, so the errors above came back inside a 2xx.',
	'Documented causes: the file key is unknown (these endpoints need the MAIN file key — a branch key is rejected),',
	'the node already has the maximum of 10 dev resources, or another dev resource on that node has the same URL.',
].join(' ')

/** Where an item failed, as `file/node` or a dev resource id. */
function locate(error: DevResourceWriteError): string {
	const parts = [error.id, error.file_key, error.node_id].filter(Boolean)
	return parts.length ? parts.join(' ') : '(unidentified item)'
}

/**
 * A bulk write where Figma rejected every item. It carries the same result the
 * partial case returns, and a message that names each rejection, so the failure
 * survives into the CLI's error body and the MCP tool error alike.
 */
export class DevResourceWriteFailed extends Error {
	readonly result: DevResourceWriteResult
	readonly hint = HINT

	constructor(result: DevResourceWriteResult) {
		const detail = result.errors.map((error) => `${locate(error)}: ${error.error}`).join('; ')
		super(`Figma rejected all ${result.failed} dev resource ${result.action}s — ${detail}`)
		this.name = 'DevResourceWriteFailed'
		this.result = result
	}
}

/**
 * The uniform result for both bulk writes. Throws when nothing succeeded, so
 * the command exits nonzero rather than acknowledging a write that never
 * happened; a partial success is returned and reported, not thrown.
 */
export function summarizeWrite(
	action: DevResourceWriteAction,
	requested: number,
	written: DevResource[],
	errors: DevResourceWriteError[] | undefined,
): DevResourceWriteResult {
	const failures = errors ?? []
	const result: DevResourceWriteResult = {
		ok: failures.length === 0,
		action,
		requested,
		succeeded: written.length,
		failed: failures.length,
		dev_resources: written,
		errors: failures,
	}
	if (failures.length > 0 && written.length === 0) throw new DevResourceWriteFailed(result)
	return result
}
