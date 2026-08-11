import { describe, expect, it } from 'vitest'
import { createRecordingClient } from '../testing/paginating-gateway.js'
import { createFigmaCommentGateway } from './gateway.js'

describe('list', () => {
	it('asks Figma for the comments of the file', async () => {
		const client = createRecordingClient([{ comments: [] }])

		await createFigmaCommentGateway(client).list('abc123')

		expect(client.requests[0]).toMatchObject({ method: 'GET', path: '/v1/files/abc123/comments' })
	})

	it('asks for markdown bodies when requested', async () => {
		const client = createRecordingClient([{ comments: [] }])

		await createFigmaCommentGateway(client).list('abc123', { asMarkdown: true })

		expect(client.requests[0].query).toEqual({ as_md: true })
	})
})

describe('create', () => {
	it('posts the comment body to the file', async () => {
		const client = createRecordingClient([{ id: '1' }])

		await createFigmaCommentGateway(client).create('abc123', { message: 'ship it' })

		expect(client.requests[0]).toMatchObject({
			method: 'POST',
			path: '/v1/files/abc123/comments',
			body: { message: 'ship it' },
		})
	})
})

describe('remove', () => {
	it('deletes the comment by id', async () => {
		const client = createRecordingClient([{ status: 200, error: false }])

		await createFigmaCommentGateway(client).remove('abc123', '99')

		expect(client.requests[0]).toMatchObject({ method: 'DELETE', path: '/v1/files/abc123/comments/99' })
	})
})

describe('listReactions', () => {
	it('asks Figma for the reactions of one comment', async () => {
		const client = createRecordingClient([{ reactions: [], pagination: {} }])

		await createFigmaCommentGateway(client).listReactions('abc123', '99')

		expect(client.requests[0]).toMatchObject({
			method: 'GET',
			path: '/v1/files/abc123/comments/99/reactions',
		})
	})

	it('sends the cursor this endpoint paginates with', async () => {
		const client = createRecordingClient([{ reactions: [], pagination: {} }])

		await createFigmaCommentGateway(client).listReactions('abc123', '99', { cursor: 'page-2' })

		expect(client.requests[0].query).toEqual({ cursor: 'page-2' })
	})
})

describe('addReaction', () => {
	it('posts the emoji shortcode in the body', async () => {
		const client = createRecordingClient([{ status: 200, error: false }])

		await createFigmaCommentGateway(client).addReaction('abc123', '99', ':heart:')

		expect(client.requests[0]).toMatchObject({
			method: 'POST',
			path: '/v1/files/abc123/comments/99/reactions',
			body: { emoji: ':heart:' },
		})
	})
})

describe('removeReaction', () => {
	// The trap: `emoji` is a required *query* parameter here, not a path segment
	// and not a body — the one place in the API where a DELETE is identified by
	// a query string.
	it('sends the emoji as a query parameter, not a path segment', async () => {
		const client = createRecordingClient([{ status: 200, error: false }])

		await createFigmaCommentGateway(client).removeReaction('abc123', '99', ':heart:')

		expect(client.requests[0]).toEqual({
			method: 'DELETE',
			path: '/v1/files/abc123/comments/99/reactions',
			query: { emoji: ':heart:' },
		})
	})
})
