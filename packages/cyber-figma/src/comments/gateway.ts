import type { FigmaRequest } from '../client.js'
import type {
	Comment,
	DeleteCommentReactionResponse,
	DeleteCommentResponse,
	GetCommentsResponse,
	PostCommentReactionResponse,
	PostCommentRequestBody,
	Reaction,
} from '../figma-types.js'
import {
	collectPages,
	type PaginatedResult,
	type PaginationOptions,
	type PaginationSpec,
	paginationParamsFor,
} from '../pagination.js'

/**
 * The client surface this gateway needs. It is narrower than `FigmaClient` in
 * the return type and wider by one argument: the pagination doubles in
 * `testing/` decide which page to serve from the `PaginationOptions` handed to
 * them as a second argument, while the real client carries the cursor in the
 * query string and ignores it. Both satisfy this shape.
 */
export type CommentClient = {
	request: (spec: FigmaRequest, opts?: PaginationOptions) => Promise<unknown>
}

function send<T>(client: CommentClient, spec: FigmaRequest, opts?: PaginationOptions): Promise<T> {
	return client.request(spec, opts) as Promise<T>
}

function commentsPath(fileKey: string): string {
	return `/v1/files/${encodeURIComponent(fileKey)}/comments`
}

function commentPath(fileKey: string, commentId: string): string {
	return `${commentsPath(fileKey)}/${encodeURIComponent(commentId)}`
}

function reactionsPath(fileKey: string, commentId: string): string {
	return `${commentPath(fileKey, commentId)}/reactions`
}

/** GET file comments returns the whole list at once — Figma paginates none of it. */
export const COMMENT_LIST_PAGINATION: PaginationSpec = { model: 'none', itemsKey: 'comments' }

/**
 * Comment reactions are one of the few genuinely paginated reads: `cursor` in,
 * whole `prev_page`/`next_page` URLs back.
 */
export const COMMENT_REACTION_LIST_PAGINATION: PaginationSpec = { model: 'url_cursor', itemsKey: 'reactions' }

export type CommentGateway = {
	list: (fileKey: string, opts?: { asMarkdown?: boolean }) => Promise<PaginatedResult<Comment>>
	create: (fileKey: string, body: PostCommentRequestBody) => Promise<Comment>
	remove: (fileKey: string, commentId: string) => Promise<DeleteCommentResponse>
	listReactions: (fileKey: string, commentId: string, opts?: PaginationOptions) => Promise<PaginatedResult<Reaction>>
	addReaction: (fileKey: string, commentId: string, emoji: string) => Promise<PostCommentReactionResponse>
	removeReaction: (fileKey: string, commentId: string, emoji: string) => Promise<DeleteCommentReactionResponse>
}

export function createFigmaCommentGateway(client: CommentClient): CommentGateway {
	return {
		// Unpaginated, but normalized through collectPages all the same, so a
		// caller sees the one result shape and can tell "there is no more" from
		// "this endpoint never paginates".
		list: (fileKey, opts) =>
			collectPages<Comment>(COMMENT_LIST_PAGINATION, () =>
				send<GetCommentsResponse>(client, {
					method: 'GET',
					path: commentsPath(fileKey),
					query: { as_md: opts?.asMarkdown },
				}),
			),
		create: (fileKey, body) =>
			send<Comment>(client, {
				method: 'POST',
				path: commentsPath(fileKey),
				body,
			}),
		remove: (fileKey, commentId) =>
			send<DeleteCommentResponse>(client, {
				method: 'DELETE',
				path: commentPath(fileKey, commentId),
			}),
		listReactions: (fileKey, commentId, opts) =>
			collectPages<Reaction>(
				COMMENT_REACTION_LIST_PAGINATION,
				(page) =>
					send(
						client,
						{
							method: 'GET',
							path: reactionsPath(fileKey, commentId),
							query: paginationParamsFor(COMMENT_REACTION_LIST_PAGINATION, page),
						},
						page,
					),
				opts,
			),
		addReaction: (fileKey, commentId, emoji) =>
			send<PostCommentReactionResponse>(client, {
				method: 'POST',
				path: reactionsPath(fileKey, commentId),
				body: { emoji },
			}),
		// `emoji` identifies which reaction to remove and Figma takes it as a
		// query parameter — not in the path and not in a body, which is what a
		// reader of the other five endpoints would expect.
		removeReaction: (fileKey, commentId, emoji) =>
			send<DeleteCommentReactionResponse>(client, {
				method: 'DELETE',
				path: reactionsPath(fileKey, commentId),
				query: { emoji },
			}),
	}
}
