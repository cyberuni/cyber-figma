import { describe, expect, it, vi } from 'vitest'
import { FigmaApiError } from './figma-error.js'
import { deleteIdempotently, deleteMessage } from './idempotent-delete.js'

function notFound() {
	return new FigmaApiError({ status: 404, method: 'DELETE', path: '/v1/files/abc/comments/1' })
}

// Deleting something already gone is the state the caller asked for — AXI
// principle 6. The result still says which of the two happened.
describe('deleteIdempotently', () => {
	it('reports a successful delete', async () => {
		const remove = vi.fn(async () => undefined)
		await expect(deleteIdempotently('comment', '1', remove)).resolves.toEqual({
			deleted: true,
			resource: 'comment',
			id: '1',
			already_absent: false,
		})
		expect(remove).toHaveBeenCalledOnce()
	})

	it('reports a 404 as already absent instead of failing', async () => {
		const result = await deleteIdempotently('comment', '1', async () => {
			throw notFound()
		})
		expect(result).toEqual({ deleted: true, resource: 'comment', id: '1', already_absent: true })
	})

	it('rethrows anything that is not a 404', async () => {
		await expect(
			deleteIdempotently('comment', '1', async () => {
				throw new FigmaApiError({ status: 403, method: 'DELETE', path: '/v1/files/abc/comments/1' })
			}),
		).rejects.toThrowError(FigmaApiError)
	})
})

describe('deleteMessage', () => {
	it('says it deleted the thing', async () => {
		const result = await deleteIdempotently('comment', '1', async () => undefined)
		expect(deleteMessage(result, 'Comment')).toBe('Deleted comment 1')
	})

	it('says the thing was already gone', async () => {
		const result = await deleteIdempotently('comment', '1', async () => {
			throw notFound()
		})
		expect(deleteMessage(result, 'Comment')).toBe('Comment 1 was already deleted')
	})
})
