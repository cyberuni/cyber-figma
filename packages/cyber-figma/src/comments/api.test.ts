import { describe, expect, it } from 'vitest'
import { FigmaApiError } from '../figma-error.js'
import type { Comment } from '../figma-types.js'
import { createRecordingClient } from '../testing/paginating-gateway.js'
import { buildCommentAnchor, createCommentApi } from './api.js'
import { createFigmaCommentGateway } from './gateway.js'

function comment(over: Partial<Comment> = {}): Comment {
	return {
		id: '1',
		client_meta: { x: 0, y: 0 },
		file_key: 'abc123',
		user: { id: 'u1', handle: 'ada', img_url: '' },
		created_at: '2026-01-01T00:00:00Z',
		resolved_at: null,
		message: 'hello',
		order_id: '1',
		reactions: [],
		...over,
	}
}

function apiWith(responses: unknown[]) {
	const client = createRecordingClient(responses)
	return { client, api: createCommentApi(createFigmaCommentGateway(client)) }
}

describe('list', () => {
	it('takes the file key out of a pasted Figma URL', async () => {
		const { client, api } = apiWith([{ comments: [] }])

		await api.list('https://www.figma.com/design/abc123/My-File?node-id=1-2')

		expect(client.requests[0].path).toBe('/v1/files/abc123/comments')
	})

	it('reports the comments in the uniform list result shape', async () => {
		const { api } = apiWith([{ comments: [comment()] }])

		const result = await api.list('abc123')

		expect(result).toMatchObject({ count: 1, next_cursor: null, pagination_model: 'none' })
		expect(result.data).toHaveLength(1)
	})

	// Figma returns a file's root comments and every reply in one flat list, and
	// nothing in the API narrows it to one conversation.
	it('narrows to one thread: the root comment and its replies', async () => {
		const { api } = apiWith([
			{
				comments: [
					comment({ id: '1' }),
					comment({ id: '2', parent_id: '1', order_id: null }),
					comment({ id: '3' }),
					comment({ id: '4', parent_id: '3', order_id: null }),
				],
			},
		])

		const result = await api.list('abc123', { thread: '1' })

		expect(result.data.map((c) => c.id)).toEqual(['1', '2'])
		expect(result.count).toBe(2)
	})
})

describe('create', () => {
	it('posts the message', async () => {
		const { client, api } = apiWith([comment({ id: '7' })])

		const created = await api.create('abc123', { message: 'ship it' })

		expect(client.requests[0].body).toEqual({ message: 'ship it' })
		expect(created.id).toBe('7')
	})

	it('replies to a comment through comment_id', async () => {
		const { client, api } = apiWith([comment({ id: '8', parent_id: '7' })])

		await api.create('abc123', { message: 'agreed', replyTo: '7' })

		expect(client.requests[0].body).toEqual({ message: 'agreed', comment_id: '7' })
	})

	it('pins the comment to a point on the canvas', async () => {
		const { client, api } = apiWith([comment()])

		await api.create('abc123', { message: 'here', anchor: { x: 12, y: 34 } })

		expect(client.requests[0].body).toEqual({ message: 'here', client_meta: { x: 12, y: 34 } })
	})
})

describe('remove', () => {
	it('reports a successful delete', async () => {
		const { api } = apiWith([{ status: 200, error: false }])

		expect(await api.remove('abc123', '99')).toEqual({
			deleted: true,
			resource: 'comment',
			id: '99',
			already_absent: false,
		})
	})

	it('treats a repeat delete as the state the caller asked for', async () => {
		const { api } = apiWith([
			new FigmaApiError({ status: 404, method: 'DELETE', path: '/v1/files/abc123/comments/99' }),
		])

		expect(await api.remove('abc123', '99')).toMatchObject({ deleted: true, already_absent: true })
	})

	// Figma answers 403 for an expired token, for no access to the file, and for
	// "you did not write this comment" — and the spine's generic 403 hint names
	// only the first two.
	it('names the author-only rule when Figma refuses the delete', async () => {
		const { api } = apiWith([
			new FigmaApiError({ status: 403, method: 'DELETE', path: '/v1/files/abc123/comments/99' }),
		])

		await expect(api.remove('abc123', '99')).rejects.toMatchObject({
			hint: expect.stringContaining('author'),
		})
	})
})

describe('reactions', () => {
	it('lists the reactions of one comment in the uniform list result shape', async () => {
		const { client, api } = apiWith([{ reactions: [{ emoji: ':heart:' }], pagination: {} }])

		const result = await api.listReactions('https://www.figma.com/design/abc123/My-File', '99')

		expect(client.requests[0].path).toBe('/v1/files/abc123/comments/99/reactions')
		expect(result).toMatchObject({ count: 1, pagination_model: 'url_cursor' })
	})

	it('acknowledges an added reaction with what was added', async () => {
		const { client, api } = apiWith([{ status: 200, error: false }])

		expect(await api.addReaction('abc123', '99', ':heart:')).toEqual({
			added: true,
			comment_id: '99',
			emoji: ':heart:',
		})
		expect(client.requests[0].body).toEqual({ emoji: ':heart:' })
	})

	it('removes a reaction idempotently, like every other delete', async () => {
		const { api } = apiWith([
			new FigmaApiError({ status: 404, method: 'DELETE', path: '/v1/files/abc123/comments/99/reactions' }),
		])

		expect(await api.removeReaction('abc123', '99', ':heart:')).toMatchObject({
			deleted: true,
			resource: 'reaction',
			already_absent: true,
		})
	})

	// Figma takes an emoji *shortcode*, not the character. A literal emoji comes
	// back as a bare 400, which reads as a bug in the caller's file key.
	it('refuses a literal emoji before spending a request on it', async () => {
		const { api } = apiWith([])

		await expect(api.addReaction('abc123', '99', '\u2764\ufe0f')).rejects.toThrow(/shortcode/)
	})

	it('names the author-only rule when Figma refuses to remove a reaction', async () => {
		const { api } = apiWith([
			new FigmaApiError({ status: 403, method: 'DELETE', path: '/v1/files/abc123/comments/99/reactions' }),
		])

		await expect(api.removeReaction('abc123', '99', ':heart:')).rejects.toMatchObject({
			hint: expect.stringContaining('reaction'),
		})
	})
})

// A plan access token is an excellent read credential and simply does not carry
// file_comments:write — Figma does not support the scope for it, so every write
// here is a 403 waiting to happen.
describe('under a plan access token', () => {
	function planApi() {
		const client = createRecordingClient([])
		return { client, api: createCommentApi(createFigmaCommentGateway(client), { authMode: 'plan' }) }
	}

	it('still reads comments', async () => {
		const client = createRecordingClient([{ comments: [] }])
		const api = createCommentApi(createFigmaCommentGateway(client), { authMode: 'plan' })

		await expect(api.list('abc123')).resolves.toMatchObject({ count: 0 })
	})

	it('refuses to post a comment, without spending the request', async () => {
		const { client, api } = planApi()

		await expect(api.create('abc123', { message: 'hi' })).rejects.toThrow(/plan access token/)
		expect(client.requests).toHaveLength(0)
	})

	it('refuses to add a reaction', async () => {
		const { api } = planApi()

		await expect(api.addReaction('abc123', '99', ':heart:')).rejects.toThrow(/plan access token/)
	})

	it('refuses to remove a reaction', async () => {
		const { api } = planApi()

		await expect(api.removeReaction('abc123', '99', ':heart:')).rejects.toThrow(/plan access token/)
	})

	it('refuses to delete a comment', async () => {
		const { api } = planApi()

		await expect(api.remove('abc123', '99')).rejects.toThrow(/plan access token/)
	})
})

describe('buildCommentAnchor', () => {
	it('leaves an unpositioned comment unanchored', () => {
		expect(buildCommentAnchor({})).toBeUndefined()
	})

	it('pins to a point on the canvas', () => {
		expect(buildCommentAnchor({ x: 10, y: 20 })).toEqual({ x: 10, y: 20 })
	})

	it('pins inside a frame, as an offset from its top-left corner', () => {
		expect(buildCommentAnchor({ nodeId: '1:23', x: 10, y: 20 })).toEqual({
			node_id: '1:23',
			node_offset: { x: 10, y: 20 },
		})
	})

	it('takes the frame node id as the URL bar spells it', () => {
		expect(buildCommentAnchor({ nodeId: '1-23' })).toEqual({ node_id: '1:23', node_offset: { x: 0, y: 0 } })
	})

	it('pins a region on the canvas', () => {
		expect(buildCommentAnchor({ x: 1, y: 2, regionWidth: 30, regionHeight: 40, pinCorner: 'bottom-left' })).toEqual({
			x: 1,
			y: 2,
			region_width: 30,
			region_height: 40,
			comment_pin_corner: 'bottom-left',
		})
	})

	it('pins a region inside a frame', () => {
		expect(buildCommentAnchor({ nodeId: '1:23', x: 1, y: 2, regionWidth: 30, regionHeight: 40 })).toEqual({
			node_id: '1:23',
			node_offset: { x: 1, y: 2 },
			region_width: 30,
			region_height: 40,
		})
	})

	it('refuses half a region, which Figma would reject as a malformed client_meta', () => {
		expect(() => buildCommentAnchor({ x: 1, y: 2, regionWidth: 30 })).toThrow(/region-height/)
	})

	it('refuses half a region even when nothing else positions the comment', () => {
		expect(() => buildCommentAnchor({ regionHeight: 40 })).toThrow(/region-width/)
	})

	it('refuses a region with no area', () => {
		expect(() => buildCommentAnchor({ x: 1, y: 2, regionWidth: 0, regionHeight: 40 })).toThrow(/greater than 0/)
	})

	it('refuses a pin corner on a comment that is not a region', () => {
		expect(() => buildCommentAnchor({ x: 1, y: 2, pinCorner: 'top-left' })).toThrow(/region/)
	})
})
