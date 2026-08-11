import { expect, it } from 'vitest'
import type { CommentApi } from './api.js'

// The contract the comments domain owes, expressed once and run twice: against
// doubles in gateway.acceptance.test.ts, and against the live Figma API in
// gateway.system.ts. Anything asserted here has to hold in both places, so
// nothing here may depend on fixture-specific ids or on a particular account.

export type CommentAcceptanceDeps = {
	api: () => CommentApi
	/** A file the credential can read. */
	file: string
	/**
	 * Whether this run may post and delete a comment. False against a live
	 * account with a read-only credential, or a plan access token, which Figma
	 * does not let write comments at all.
	 */
	includeWrites?: boolean
}

export function defineCommentAcceptanceSpecs(deps: CommentAcceptanceDeps) {
	return () => {
		it('lists the comments of a file in the uniform result shape', async () => {
			const result = await deps.api().list(deps.file)

			expect(Array.isArray(result.data)).toBe(true)
			expect(result.count).toBe(result.data.length)
			// The comments endpoint returns everything at once, and says so rather
			// than leaving a caller to wonder whether it truncated.
			expect(result.pagination_model).toBe('none')
			expect(result.next_cursor).toBeNull()
		})

		it('accepts a file URL wherever it accepts a file key', async () => {
			const api = deps.api()
			const byKey = await api.list(deps.file)
			const byUrl = await api.list(`https://www.figma.com/design/${deps.file}/Acceptance`)

			expect(byUrl.count).toBe(byKey.count)
		})

		it('refuses a reaction that is not an emoji shortcode', async () => {
			await expect(deps.api().addReaction(deps.file, 'unused', '❤️')).rejects.toThrow(/shortcode/)
		})

		if (deps.includeWrites === false) return

		it('posts a comment, reads it back, and deletes it', async () => {
			const api = deps.api()
			const created = await api.create(deps.file, { message: `cyber-figma acceptance ${Date.now()}` })

			expect(created.id).toBeTruthy()
			expect((await api.list(deps.file)).data.map((comment) => comment.id)).toContain(created.id)

			expect(await api.remove(deps.file, created.id)).toMatchObject({
				deleted: true,
				resource: 'comment',
				already_absent: false,
			})
		})

		// Figma returns a file's roots and every reply in one flat list and offers
		// no parameter that narrows it, so this is done from the response.
		it('narrows a list to one thread', async () => {
			const api = deps.api()
			const root = await api.create(deps.file, { message: 'cyber-figma acceptance thread' })
			const reply = await api.create(deps.file, { message: 'cyber-figma acceptance thread reply', replyTo: root.id })

			const thread = await api.list(deps.file, { thread: root.id })

			expect(thread.data.map((comment) => comment.id).sort()).toEqual([root.id, reply.id].sort())
			expect(thread.count).toBe(2)

			await api.remove(deps.file, reply.id)
			await api.remove(deps.file, root.id)
		})

		it('replies to a root comment, and the reply names its parent', async () => {
			const api = deps.api()
			const root = await api.create(deps.file, { message: 'cyber-figma acceptance root' })
			const reply = await api.create(deps.file, { message: 'cyber-figma acceptance reply', replyTo: root.id })

			expect(reply.parent_id).toBe(root.id)
			// Only top-level comments carry the number the UI shows.
			expect(reply.order_id).toBeNull()

			await api.remove(deps.file, reply.id)
			await api.remove(deps.file, root.id)
		})

		it('pins a comment to a point on the canvas', async () => {
			const api = deps.api()
			const created = await api.create(deps.file, {
				message: 'cyber-figma acceptance pin',
				anchor: { x: 100, y: 200 },
			})

			expect(created.client_meta).toMatchObject({ x: 100, y: 200 })

			await api.remove(deps.file, created.id)
		})

		it('reports a repeated delete as already absent rather than failing', async () => {
			const api = deps.api()
			const created = await api.create(deps.file, { message: 'cyber-figma acceptance idempotent delete' })

			await api.remove(deps.file, created.id)

			expect(await api.remove(deps.file, created.id)).toMatchObject({ deleted: true, already_absent: true })
		})

		it('reacts to a comment, lists the reaction, and removes it', async () => {
			const api = deps.api()
			const created = await api.create(deps.file, { message: 'cyber-figma acceptance reaction' })

			expect(await api.addReaction(deps.file, created.id, ':heart:')).toMatchObject({
				added: true,
				emoji: ':heart:',
			})

			const reactions = await api.listReactions(deps.file, created.id)
			expect(reactions.pagination_model).toBe('url_cursor')
			expect(reactions.data.map((reaction) => reaction.emoji)).toContain(':heart:')

			expect(await api.removeReaction(deps.file, created.id, ':heart:')).toMatchObject({ deleted: true })
			await api.remove(deps.file, created.id)
		})
	}
}
