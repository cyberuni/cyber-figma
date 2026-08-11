import { describe } from 'vitest'
import type { FigmaRequest } from '../client.js'
import { FigmaApiError } from '../figma-error.js'
import type { Comment, Reaction } from '../figma-types.js'
import { collectPages, type PaginationOptions } from '../pagination.js'
import { defineListPaginationAcceptanceSpecs } from '../testing/list-pagination.acceptance.js'
import { createPaginatingClient } from '../testing/paginating-gateway.js'
import { createCommentApi } from './api.js'
import { defineCommentAcceptanceSpecs } from './gateway.acceptance.js'
import { COMMENT_REACTION_LIST_PAGINATION, type CommentClient, createFigmaCommentGateway } from './gateway.js'

// The acceptance specs need a double that *holds state*: they post a comment,
// read it back, react to it, and delete it. A queue of canned responses cannot
// answer that, so this is a small in-memory stand-in for the six endpoints,
// answering in the wire shapes documented in docs/research/figma-rest-api.md.

const COMMENTS = /^\/v1\/files\/([^/]+)\/comments$/
const COMMENT = /^\/v1\/files\/([^/]+)\/comments\/([^/]+)$/
const REACTIONS = /^\/v1\/files\/([^/]+)\/comments\/([^/]+)\/reactions$/

const USER = { id: 'u1', handle: 'ada', img_url: '' }

function notFound(request: FigmaRequest): FigmaApiError {
	return new FigmaApiError({ status: 404, method: request.method, path: request.path, detail: 'Not found' })
}

function createFigmaCommentsDouble(): CommentClient {
	const comments = new Map<string, Comment>()
	const reactions = new Map<string, Reaction[]>()
	let nextId = 1

	return {
		async request(request: FigmaRequest, opts: PaginationOptions = {}) {
			const query = (request.query ?? {}) as Record<string, string | boolean | undefined>

			const reactionMatch = REACTIONS.exec(request.path)
			if (reactionMatch) {
				const commentId = decodeURIComponent(reactionMatch[2])
				if (!comments.has(commentId)) throw notFound(request)
				const existing = reactions.get(commentId) ?? []

				if (request.method === 'POST') {
					const emoji = (request.body as { emoji: string }).emoji
					reactions.set(commentId, [...existing, { user: USER, emoji, created_at: '2026-01-01T00:00:00Z' }])
					return { status: 200, error: false }
				}
				if (request.method === 'DELETE') {
					const emoji = String(query.emoji)
					const index = existing.findIndex((reaction) => reaction.emoji === emoji)
					if (index === -1) throw notFound(request)
					reactions.set(commentId, [...existing.slice(0, index), ...existing.slice(index + 1)])
					return { status: 200, error: false }
				}
				// One reaction per page, so the walk over the url_cursor model is
				// exercised rather than assumed.
				const start = Number(opts.cursor ?? query.cursor ?? 0)
				const page = existing.slice(start, start + 1)
				const hasNext = start + 1 < existing.length
				return {
					reactions: page,
					pagination: hasNext ? { next_page: `https://api.figma.com/v1/x?cursor=${start + 1}` } : {},
				}
			}

			const commentMatch = COMMENT.exec(request.path)
			if (commentMatch && request.method === 'DELETE') {
				const commentId = decodeURIComponent(commentMatch[2])
				if (!comments.delete(commentId)) throw notFound(request)
				return { status: 200, error: false }
			}

			const listMatch = COMMENTS.exec(request.path)
			if (listMatch && request.method === 'POST') {
				const body = request.body as { message: string; comment_id?: string; client_meta?: unknown }
				const id = String(nextId++)
				const created: Comment = {
					id,
					client_meta: (body.client_meta ?? { x: 0, y: 0 }) as Comment['client_meta'],
					file_key: decodeURIComponent(listMatch[1]),
					...(body.comment_id !== undefined && { parent_id: body.comment_id }),
					user: USER,
					created_at: '2026-01-01T00:00:00Z',
					resolved_at: null,
					message: body.message,
					// Only top-level comments carry the number the UI shows.
					order_id: body.comment_id === undefined ? id : null,
					reactions: [],
				}
				comments.set(id, created)
				return created
			}
			if (listMatch && request.method === 'GET') {
				return { comments: [...comments.values()] }
			}

			throw notFound(request)
		},
	}
}

describe(
	'the comments domain against a double',
	defineCommentAcceptanceSpecs({
		api: () => createCommentApi(createFigmaCommentGateway(createFigmaCommentsDouble())),
		file: 'abc123',
	}),
)

describe(
	'comment list',
	defineListPaginationAcceptanceSpecs({
		model: 'none',
		list: (opts) =>
			collectPages<Comment>(
				{ model: 'none', itemsKey: 'comments' },
				() => createFigmaCommentsDouble().request({ method: 'GET', path: '/v1/files/abc123/comments' }),
				opts,
			),
	}),
)

describe(
	'comment reaction list',
	defineListPaginationAcceptanceSpecs({
		model: 'url_cursor',
		list: (opts) =>
			createFigmaCommentGateway(
				createPaginatingClient(COMMENT_REACTION_LIST_PAGINATION, [['a'], ['b'], ['c']]) as CommentClient,
			).listReactions('abc123', '99', opts),
	}),
)
