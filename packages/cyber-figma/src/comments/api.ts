import type { FigmaAuthMode } from '../client.js'
import { isFigmaApiError } from '../figma-error.js'
import type { Comment, FrameOffset, FrameOffsetRegion, Reaction, Region, Vector } from '../figma-types.js'
import { type DeleteResult, deleteIdempotently } from '../idempotent-delete.js'
import type { PaginatedResult, PaginationOptions } from '../pagination.js'
import { fileKeyFromInput, normalizeNodeId } from '../url.js'
import type { CommentGateway } from './gateway.js'

// The operations the CLI and the MCP server both call. Every file parameter
// goes through fileKeyFromInput, so a pasted Figma URL works everywhere a bare
// file key does.

/**
 * Where a comment is pinned. Figma calls this `client_meta` and accepts four
 * shapes: a point on the canvas, an offset inside a frame, and the region
 * variants of each.
 */
export type CommentAnchor = Vector | FrameOffset | Region | FrameOffsetRegion

/** The flat positioning options a CLI flag set or an MCP tool schema can carry. */
export type CommentAnchorInput = {
	x?: number
	y?: number
	nodeId?: string
	regionWidth?: number
	regionHeight?: number
	pinCorner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

type RegionFields = {
	region_width: number
	region_height: number
	comment_pin_corner?: CommentAnchorInput['pinCorner']
}

/**
 * The region half of an anchor. Both dimensions are required together and both
 * must have area — Figma answers a malformed `client_meta` with a bare 400, so
 * the half-specified cases are worth naming here rather than round-tripping.
 */
function regionOf(input: CommentAnchorInput): RegionFields | undefined {
	const { regionWidth, regionHeight, pinCorner } = input
	if (regionWidth === undefined && regionHeight === undefined) {
		if (pinCorner !== undefined) {
			throw new Error('A comment pin corner only applies to a region — pass --region-width and --region-height too')
		}
		return undefined
	}
	if (regionWidth === undefined || regionHeight === undefined) {
		throw new Error('A comment region needs both --region-width and --region-height')
	}
	if (regionWidth <= 0 || regionHeight <= 0) {
		throw new Error('A comment region must have a width and height greater than 0')
	}
	return {
		region_width: regionWidth,
		region_height: regionHeight,
		...(pinCorner !== undefined && { comment_pin_corner: pinCorner }),
	}
}

/**
 * The `client_meta` for a set of flat positioning options — Figma's four anchor
 * shapes are distinguished only by which fields are present, so building one by
 * hand is easy to get subtly wrong.
 */
export function buildCommentAnchor(input: CommentAnchorInput): CommentAnchor | undefined {
	// regionOf runs first, so a half-specified region is reported even when
	// nothing else positions the comment.
	const region = regionOf(input)
	if (region === undefined && input.x === undefined && input.y === undefined && input.nodeId === undefined) {
		return undefined
	}

	const point = { x: input.x ?? 0, y: input.y ?? 0 }

	// Inside a frame the point is an offset from the frame's top-left corner
	// rather than an absolute canvas position — same two numbers, different
	// meaning and a different field name.
	if (input.nodeId !== undefined) {
		return { node_id: normalizeNodeId(input.nodeId), node_offset: point, ...region }
	}
	return { ...point, ...region }
}

export type CommentListOptions = {
	asMarkdown?: boolean
	/** Narrow to one conversation: the root comment with this id, and its replies. */
	thread?: string
}

export type CreateCommentInput = {
	message: string
	/**
	 * The comment being replied to. Figma requires a **root** comment here: a
	 * reply cannot itself be replied to.
	 */
	replyTo?: string
	/** Where to pin the comment. Omitted, the comment is not anchored to anything. */
	anchor?: CommentAnchor
}

export type CommentApi = {
	list: (file: string, opts?: CommentListOptions) => Promise<PaginatedResult<Comment>>
	create: (file: string, input: CreateCommentInput) => Promise<Comment>
	remove: (file: string, commentId: string) => Promise<DeleteResult>
	listReactions: (file: string, commentId: string, opts?: PaginationOptions) => Promise<PaginatedResult<Reaction>>
	addReaction: (file: string, commentId: string, emoji: string) => Promise<AddReactionResult>
	removeReaction: (file: string, commentId: string, emoji: string) => Promise<DeleteResult>
}

/**
 * The acknowledgement of an added reaction. Figma answers `{ status, error }`
 * and nothing else, so the useful part — which reaction landed on which
 * comment — has to be echoed from the request.
 */
export type AddReactionResult = {
	added: true
	comment_id: string
	emoji: string
}

const REACTION_AUTHOR_ONLY_HINT =
	'Figma allows only the person who left a reaction to remove it, and answers 403 when someone else tries. Check who reacted with `cyber-figma comment reaction list <file> <comment-id>` before assuming the credential is at fault.'

/** A shortcode as Figma spells it: `:heart:`, `:+1::skin-tone-2:`. */
const EMOJI_SHORTCODE = /^(:[a-z0-9_+-]+:)+$/i

/**
 * Figma takes an emoji **shortcode**, never the character itself, and answers a
 * literal emoji with a bare 400 that names nothing. The accepted list is
 * published as an external file rather than in the schema, so the shape is all
 * that can be checked here — but the shape is what callers get wrong.
 */
export function requireEmojiShortcode(emoji: string): string {
	const value = emoji.trim()
	if (EMOJI_SHORTCODE.test(value)) return value
	throw withHint(
		new Error(`"${emoji}" is not an emoji shortcode`),
		'Figma reactions take a shortcode such as :heart: or :+1::skin-tone-2:, not the emoji character. The accepted list is the emoji-mart data file linked from the API docs: https://raw.githubusercontent.com/missive/emoji-mart/main/packages/emoji-mart-data/sets/14/native.json',
	)
}

const AUTHOR_ONLY_HINT =
	'Figma allows only the author of a comment to delete it, and answers 403 when someone else tries — the same status it uses for an expired token and for no access to the file. Check who posted it with `cyber-figma comment list <file>` before assuming the credential is at fault.'

/**
 * A hint this operation knows and the status code does not. It outranks the
 * hint `figma-error.ts` derives, which is the point: 403 on a comment delete
 * has a third cause the generic text cannot know about.
 */
function withHint<E>(error: E, hint: string): E {
	return error instanceof Error && !('hint' in error) ? Object.assign(error, { hint }) : error
}

/**
 * One conversation out of the flat list Figma returns. A file's root comments
 * and every reply to them come back together, and no request parameter narrows
 * that — a reply is only recognizable by its `parent_id`.
 */
export function threadOf(comments: Comment[], rootId: string): Comment[] {
	return comments.filter((comment) => comment.id === rootId || comment.parent_id === rootId)
}

/** Re-count a result after filtering, so `count` never contradicts `data`. */
function recount<T>(result: PaginatedResult<T>, data: T[]): PaginatedResult<T> {
	return { ...result, data, count: data.length }
}

export type CommentApiOptions = {
	/** The mode the client sends its credential in. Plan tokens cannot write here. */
	authMode?: FigmaAuthMode
}

/**
 * Every write in this domain needs `file_comments:write`, and Figma does not
 * support that scope for plan access tokens at all — so under `--auth-mode
 * plan` the request is refused here rather than sent to be refused as a 403,
 * which would land under the generic "your token may have expired" hint.
 *
 * The message names FIGMA_ACCESS_TOKEN because that is the fix, and because it
 * is what makes this a configuration failure (exit code 3) rather than a
 * generic one.
 */
function requireCommentWrites(authMode: FigmaAuthMode | undefined): void {
	if (authMode !== 'plan') return
	throw withHint(
		new Error(
			'Figma plan access tokens cannot write comments or reactions: the file_comments:write scope is not supported for them. Set FIGMA_ACCESS_TOKEN to a personal access token and drop --auth-mode plan, or use OAuth with the file_comments:write scope.',
		),
		'Plan access tokens are read/automation credentials. They also cannot reach /v1/me, /v1/oembed, or variable writes. Reading comments and reactions works normally with one.',
	)
}

export function createCommentApi(gateway: CommentGateway, options: CommentApiOptions = {}): CommentApi {
	const guardWrites = () => {
		requireCommentWrites(options.authMode)
	}
	return {
		list: async (file, opts) => {
			const result = await gateway.list(fileKeyFromInput(file), opts)
			return opts?.thread ? recount(result, threadOf(result.data, opts.thread)) : result
		},
		create: async (file, input) => {
			guardWrites()
			return gateway.create(fileKeyFromInput(file), {
				message: input.message,
				...(input.replyTo !== undefined && { comment_id: input.replyTo }),
				...(input.anchor !== undefined && { client_meta: input.anchor }),
			})
		},
		remove: async (file, commentId) => {
			guardWrites()
			return deleteIdempotently('comment', commentId, async () => {
				try {
					return await gateway.remove(fileKeyFromInput(file), commentId)
				} catch (error) {
					throw isFigmaApiError(error) && error.status === 403 ? withHint(error, AUTHOR_ONLY_HINT) : error
				}
			})
		},
		listReactions: (file, commentId, opts) => gateway.listReactions(fileKeyFromInput(file), commentId, opts),
		addReaction: async (file, commentId, emoji) => {
			guardWrites()
			const shortcode = requireEmojiShortcode(emoji)
			await gateway.addReaction(fileKeyFromInput(file), commentId, shortcode)
			return { added: true, comment_id: commentId, emoji: shortcode }
		},
		removeReaction: async (file, commentId, emoji) => {
			guardWrites()
			const shortcode = requireEmojiShortcode(emoji)
			return deleteIdempotently('reaction', shortcode, async () => {
				try {
					return await gateway.removeReaction(fileKeyFromInput(file), commentId, shortcode)
				} catch (error) {
					throw isFigmaApiError(error) && error.status === 403 ? withHint(error, REACTION_AUTHOR_ONLY_HINT) : error
				}
			})
		},
	}
}
