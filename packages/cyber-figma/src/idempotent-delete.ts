import { buildFigmaErrorBody } from './figma-error.js'

// Idempotent deletes — AXI principle 6. Deleting something that is already gone
// is the state the caller asked for, so a repeated delete succeeds instead of
// failing with a 404. The result says which of the two happened, so a caller
// that cares can still tell.

export type DeleteResult = {
	deleted: true
	resource: string
	id: string
	already_absent: boolean
}

function isNotFound(error: unknown): boolean {
	return buildFigmaErrorBody(error).error.status === 404
}

export async function deleteIdempotently(
	resource: string,
	id: string,
	remove: () => Promise<unknown>,
): Promise<DeleteResult> {
	try {
		await remove()
		return { deleted: true, resource, id, already_absent: false }
	} catch (error) {
		if (!isNotFound(error)) throw error
		return { deleted: true, resource, id, already_absent: true }
	}
}

export function deleteMessage(result: DeleteResult, label: string): string {
	return result.already_absent
		? `${label} ${result.id} was already deleted`
		: `Deleted ${label.toLowerCase()} ${result.id}`
}
