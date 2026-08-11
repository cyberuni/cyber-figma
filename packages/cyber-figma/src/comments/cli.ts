import { Command, InvalidArgumentError } from 'commander'
import {
	addPaginationOptions,
	type PaginationCliOptions,
	paginationOptionsFromCli,
	printNextPageHint,
} from '../cli-options.js'
import { deleteMessage } from '../idempotent-delete.js'
import { output, printCountSummary, printFields, printNextSteps, printTable } from '../output.js'
import { isFull, truncate } from '../truncate.js'
import { buildCommentAnchor, type CommentApi } from './api.js'
import { COMMENT_REACTION_LIST_PAGINATION } from './gateway.js'

const PIN_CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const

type PinCorner = (typeof PIN_CORNERS)[number]

type CreateOptions = {
	message: string
	replyTo?: string
	nodeId?: string
	x?: number
	y?: number
	regionWidth?: number
	regionHeight?: number
	pinCorner?: PinCorner
}

function parseCoordinate(value: string): number {
	const parsed = Number(value)
	if (!Number.isFinite(parsed)) throw new InvalidArgumentError('must be a number')
	return parsed
}

function parsePinCorner(value: string): PinCorner {
	if (!PIN_CORNERS.includes(value as PinCorner)) {
		throw new InvalidArgumentError(`must be one of ${PIN_CORNERS.join(', ')}`)
	}
	return value as PinCorner
}

export function commentCommand(getApi: () => CommentApi): Command {
	const cmd = new Command('comment').description('Comments on a Figma file, and reactions to them')

	cmd
		.command('list')
		.description('List the comments on a file')
		.argument('<file>', 'File key or Figma file URL')
		.option('--as-md', 'Return comment bodies as markdown where applicable')
		.option('--thread <comment-id>', 'Only this root comment and its replies')
		.action(async (file: string, opts: { asMd?: boolean; thread?: string }) => {
			const result = await getApi().list(file, { asMarkdown: opts.asMd, thread: opts.thread })
			output(result, () => {
				printTable(
					result.data,
					[
						{ label: 'id', get: (c) => c.id },
						{ label: 'author', get: (c) => c.user.handle },
						{ label: 'state', get: (c) => (c.resolved_at ? 'resolved' : 'open') },
						// Figma returns roots and replies in one flat list; without this
						// column a thread reads as unrelated comments.
						{ label: 'reply to', get: (c) => c.parent_id ?? '' },
						{ label: 'message', get: (c) => truncate(c.message, { full: isFull() }) },
					],
					{ entity: 'comments' },
				)
				printCountSummary(result.count, 'comment(s)')
				printNextSteps([`cyber-figma comment create ${file} --message "<text>"`])
			})
		})

	cmd
		.command('create')
		.description('Post a comment on a file, optionally as a reply or pinned to a spot')
		.argument('<file>', 'File key or Figma file URL')
		.requiredOption('--message <text>', 'The comment text')
		.option('--reply-to <comment-id>', 'Reply to this comment (must be a root comment, not itself a reply)')
		.option('--node-id <id>', 'Pin inside this frame; --x/--y become the offset from its top-left corner')
		.option('--x <number>', 'X position on the canvas, or inside the frame with --node-id', parseCoordinate)
		.option('--y <number>', 'Y position on the canvas, or inside the frame with --node-id', parseCoordinate)
		.option('--region-width <number>', 'Make it a region comment this wide (with --region-height)', parseCoordinate)
		.option('--region-height <number>', 'Make it a region comment this tall (with --region-width)', parseCoordinate)
		.option('--pin-corner <corner>', 'Which corner of a region carries the pin', parsePinCorner)
		.action(async (file: string, opts: CreateOptions) => {
			const anchor = buildCommentAnchor({
				x: opts.x,
				y: opts.y,
				nodeId: opts.nodeId,
				regionWidth: opts.regionWidth,
				regionHeight: opts.regionHeight,
				pinCorner: opts.pinCorner,
			})
			const created = await getApi().create(file, {
				message: opts.message,
				...(opts.replyTo !== undefined && { replyTo: opts.replyTo }),
				...(anchor !== undefined && { anchor }),
			})
			output(created, () => {
				printFields({
					id: created.id,
					author: created.user.handle,
					'reply to': created.parent_id,
					message: truncate(created.message, { full: isFull() }),
				})
				printNextSteps([
					`cyber-figma comment reaction add ${file} ${created.id} --emoji :+1:`,
					`cyber-figma comment delete ${file} ${created.id}`,
				])
			})
		})

	cmd
		.command('delete')
		.description('Delete a comment — only its author may')
		.argument('<file>', 'File key or Figma file URL')
		.argument('<comment-id>', 'Id of the comment to delete')
		.action(async (file: string, commentId: string) => {
			const result = await getApi().remove(file, commentId)
			output(result, () => {
				console.log(deleteMessage(result, 'Comment'))
			})
		})

	cmd.addCommand(reactionCommand(getApi))

	return cmd
}

/**
 * Reactions are their own Figma endpoint group hanging off a comment, so they
 * are their own subcommand group rather than four more flags on `comment`.
 */
function reactionCommand(getApi: () => CommentApi): Command {
	const cmd = new Command('reaction').description('Reactions on a comment')

	addPaginationOptions(
		cmd
			.command('list')
			.description('List the reactions on a comment')
			.argument('<file>', 'File key or Figma file URL')
			.argument('<comment-id>', 'Id of the comment')
			.action(async (file: string, commentId: string, opts: PaginationCliOptions) => {
				const result = await getApi().listReactions(file, commentId, paginationOptionsFromCli(opts))
				output(result, () => {
					printTable(
						result.data,
						[
							{ label: 'emoji', get: (r) => r.emoji },
							{ label: 'user', get: (r) => r.user.handle },
							{ label: 'created at', get: (r) => r.created_at },
						],
						{ entity: 'reactions' },
					)
					printCountSummary(result.count, 'reaction(s)')
					printNextPageHint(result, `cyber-figma comment reaction list ${file} ${commentId}`)
				})
			}),
		COMMENT_REACTION_LIST_PAGINATION,
	)

	cmd
		.command('add')
		.description('React to a comment')
		.argument('<file>', 'File key or Figma file URL')
		.argument('<comment-id>', 'Id of the comment')
		.requiredOption('--emoji <shortcode>', 'Emoji shortcode, e.g. :heart: or :+1::skin-tone-2:')
		.action(async (file: string, commentId: string, opts: { emoji: string }) => {
			const result = await getApi().addReaction(file, commentId, opts.emoji)
			output(result, () => {
				console.log(`Reacted ${result.emoji} to comment ${result.comment_id}`)
			})
		})

	cmd
		.command('delete')
		.description('Remove your reaction from a comment — only the person who left it may')
		.argument('<file>', 'File key or Figma file URL')
		.argument('<comment-id>', 'Id of the comment')
		.requiredOption('--emoji <shortcode>', 'The emoji shortcode to remove')
		.action(async (file: string, commentId: string, opts: { emoji: string }) => {
			const result = await getApi().removeReaction(file, commentId, opts.emoji)
			output(result, () => {
				console.log(deleteMessage(result, 'Reaction'))
			})
		})

	return cmd
}
