import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { paginationOptions, paginationParams } from '../mcp-options.js'
import { buildCommentAnchor, type CommentApi } from './api.js'
import { COMMENT_REACTION_LIST_PAGINATION } from './gateway.js'

const file = z.string().describe('File key or Figma file URL')
const commentId = z.string().describe('Id of the comment')

/** JSON text is the contract; TOON is applied centrally by withMcpOutputFormat. */
function asToolResult(result: unknown) {
	return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
}

export function registerCommentTools(server: McpServer, getApi: () => CommentApi) {
	server.tool(
		'figma_comment_list',
		'List the comments on a Figma file. Returns root comments and replies in one flat list; a reply carries parent_id.',
		{
			file,
			as_md: z.boolean().optional().describe('Return comment bodies as markdown where applicable'),
			thread: z.string().optional().describe('Only this root comment and its replies'),
		},
		async ({ file: fileInput, as_md, thread }) =>
			asToolResult(await getApi().list(fileInput, { asMarkdown: as_md, thread })),
	)

	server.tool(
		'figma_comment_create',
		'Post a comment on a Figma file, optionally as a reply or pinned to a point, frame, or region. Not available with a plan access token.',
		{
			file,
			message: z.string().describe('The comment text'),
			reply_to: z
				.string()
				.optional()
				.describe('Reply to this comment. Must be a root comment — Figma rejects a reply to a reply'),
			node_id: z.string().optional().describe('Pin inside this frame; x/y become the offset from its top-left corner'),
			x: z.number().optional().describe('X position on the canvas, or inside the frame with node_id'),
			y: z.number().optional().describe('Y position on the canvas, or inside the frame with node_id'),
			region_width: z.number().optional().describe('Make it a region comment this wide (with region_height)'),
			region_height: z.number().optional().describe('Make it a region comment this tall (with region_width)'),
			pin_corner: z
				.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right'])
				.optional()
				.describe('Which corner of a region carries the pin'),
		},
		async ({ file: fileInput, message, reply_to, node_id, x, y, region_width, region_height, pin_corner }) => {
			const anchor = buildCommentAnchor({
				x,
				y,
				nodeId: node_id,
				regionWidth: region_width,
				regionHeight: region_height,
				pinCorner: pin_corner,
			})
			return asToolResult(
				await getApi().create(fileInput, {
					message,
					...(reply_to !== undefined && { replyTo: reply_to }),
					...(anchor !== undefined && { anchor }),
				}),
			)
		},
	)

	server.tool(
		'figma_comment_delete',
		'Delete a comment. Only the author of a comment may delete it. Deleting one that is already gone succeeds with already_absent.',
		{ file, comment_id: commentId },
		async ({ file: fileInput, comment_id }) => asToolResult(await getApi().remove(fileInput, comment_id)),
	)

	server.tool(
		'figma_comment_reaction_list',
		'List the reactions on a Figma comment',
		{ file, comment_id: commentId, ...paginationParams(COMMENT_REACTION_LIST_PAGINATION) },
		async ({ file: fileInput, comment_id, ...page }) =>
			asToolResult(await getApi().listReactions(fileInput, comment_id, paginationOptions(page))),
	)

	server.tool(
		'figma_comment_reaction_add',
		'React to a Figma comment with an emoji shortcode such as :heart: or :+1::skin-tone-2:. Not available with a plan access token.',
		{ file, comment_id: commentId, emoji: z.string().describe('Emoji shortcode, e.g. :heart:') },
		async ({ file: fileInput, comment_id, emoji }) =>
			asToolResult(await getApi().addReaction(fileInput, comment_id, emoji)),
	)

	server.tool(
		'figma_comment_reaction_delete',
		'Remove a reaction from a Figma comment. Only the person who left it may remove it.',
		{ file, comment_id: commentId, emoji: z.string().describe('The emoji shortcode to remove') },
		async ({ file: fileInput, comment_id, emoji }) =>
			asToolResult(await getApi().removeReaction(fileInput, comment_id, emoji)),
	)
}
