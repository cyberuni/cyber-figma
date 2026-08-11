import { Command, InvalidArgumentError } from 'commander'
import {
	addPaginationOptions,
	type PaginationCliOptions,
	paginationOptionsFromCli,
	printNextPageHint,
} from '../cli-options.js'
import { output, printCountSummary, printFields, printNextSteps, printSummary, printTable } from '../output.js'
import { isFull, truncate } from '../truncate.js'
import type { FileApi } from './api.js'
import { FILE_VERSION_PAGINATION } from './gateway.js'

// Three of these commands (get, nodes, images) sit on Figma's tier-1 rate
// limit, where a View or Collab seat gets roughly six calls a month. Every one
// of them says so in its help text and points at `file meta`, which is tier 3.

const TIER_1_NOTE =
	'Rate limit tier 1 — the most expensive tier; a View or Collab seat is allowed roughly 6 tier-1 calls per month. Use `file meta` for listing and inspection.'

const RENDER_FORMATS = ['jpg', 'png', 'svg', 'pdf'] as const

type RenderFormat = (typeof RENDER_FORMATS)[number]

function parseDepth(value: string): number | 'all' {
	if (value === 'all') return 'all'
	const depth = Number(value)
	if (!Number.isInteger(depth) || depth < 1) {
		throw new InvalidArgumentError('depth must be a positive integer, or "all" for the whole tree')
	}
	return depth
}

function parseScale(value: string): number {
	const scale = Number(value)
	if (!Number.isFinite(scale) || scale < 0.01 || scale > 4) {
		throw new InvalidArgumentError('scale must be a number between 0.01 and 4')
	}
	return scale
}

function parseFormat(value: string): RenderFormat {
	if (!RENDER_FORMATS.includes(value as RenderFormat)) {
		throw new InvalidArgumentError(`format must be one of: ${RENDER_FORMATS.join(', ')}`)
	}
	return value as RenderFormat
}

/** A node summary that survives whatever shape the node under it has. */
function nodeRow(node: unknown): { id: string; name: string; type: string } {
	const record = (node ?? {}) as { id?: string; name?: string; type?: string }
	return { id: record.id ?? '', name: record.name ?? '', type: record.type ?? '' }
}

/** Figma document trees are deep, so the payload is trimmed unless --full says otherwise. */
function printPayload(label: string, payload: unknown) {
	console.log(`\n${label}: ${truncate(JSON.stringify(payload), { full: isFull() })}`)
}

export function fileCommand(getApi: () => FileApi): Command {
	const cmd = new Command('file').description('Figma files: document, nodes, renders, metadata, and version history')

	cmd
		.command('get')
		.description(`Get a file's document tree. ${TIER_1_NOTE}`)
		.argument('<file>', 'File key, branch key, or Figma file URL')
		.option('--ids <ids>', 'Only these node ids (comma-separated; dashed URL ids are accepted)')
		.option(
			'--depth <n|all>',
			'Tree depth: 1 = pages, 2 = pages and their top-level objects, all = whole tree',
			parseDepth,
		)
		.option('--version <id>', 'A specific version id (default: the current version)')
		.option('--geometry', 'Include vector geometry as paths')
		.option('--plugin-data <ids>', 'Comma-separated plugin ids and/or the string "shared"')
		.option('--branch-data', 'Include branch metadata — the only way to obtain a branch key')
		.addHelpText(
			'after',
			'\nWith neither --ids nor --depth this asks for pages only (depth 1), because an\nunbounded request returns the entire document tree.',
		)
		.action(
			async (
				file: string,
				opts: {
					ids?: string
					depth?: number | 'all'
					version?: string
					geometry?: boolean
					pluginData?: string
					branchData?: boolean
				},
			) => {
				const result = await getApi().get(file, {
					ids: opts.ids,
					depth: opts.depth,
					version: opts.version,
					geometry: opts.geometry ? 'paths' : undefined,
					pluginData: opts.pluginData,
					branchData: opts.branchData,
				})

				output(result, () => {
					printFields({
						name: result.name,
						version: result.version,
						role: result.role,
						editorType: result.editorType,
						lastModified: result.lastModified,
					})
					const pages = (result.document?.children ?? []).map(nodeRow)
					console.log('')
					printTable(
						pages,
						[
							{ label: 'id', get: (page) => page.id },
							{ label: 'name', get: (page) => truncate(page.name, { full: isFull(), limit: 60 }) },
							{ label: 'type', get: (page) => page.type },
						],
						{ entity: 'pages' },
					)
					printCountSummary(pages.length, 'page(s)')
					printPayload('document', result.document)
					printNextSteps([
						`cyber-figma file nodes ${file} --ids <id>`,
						`cyber-figma file images ${file} --ids <id[,id…]>`,
					])
				})
			},
		)

	cmd
		.command('nodes')
		.description(`Get the document of specific nodes. ${TIER_1_NOTE}`)
		.argument('<file>', 'File key, branch key, or Figma file URL')
		.requiredOption('--ids <ids>', 'Node ids (comma-separated; dashed URL ids are accepted)')
		.option('--depth <n|all>', 'How deep to traverse from each node (default: the whole subtree)', parseDepth)
		.option('--version <id>', 'A specific version id (default: the current version)')
		.option('--geometry', 'Include vector geometry as paths')
		.option('--plugin-data <ids>', 'Comma-separated plugin ids and/or the string "shared"')
		.action(
			async (
				file: string,
				opts: { ids: string; depth?: number | 'all'; version?: string; geometry?: boolean; pluginData?: string },
			) => {
				const result = await getApi().nodes(file, opts.ids, {
					depth: opts.depth,
					version: opts.version,
					geometry: opts.geometry ? 'paths' : undefined,
					pluginData: opts.pluginData,
				})

				output(result, () => {
					// The map key is the id that was asked for, which is the one to report.
					const rows = Object.entries(result.nodes ?? {}).map(([id, entry]) => ({ ...nodeRow(entry?.document), id }))
					printTable(
						rows,
						[
							{ label: 'node_id', get: (row) => row.id },
							{ label: 'name', get: (row) => truncate(row.name, { full: isFull(), limit: 60 }) },
							{ label: 'type', get: (row) => row.type },
						],
						{ entity: 'nodes' },
					)
					printCountSummary(rows.length, 'node(s)')
					printPayload('nodes', result.nodes)
					printNextSteps([`cyber-figma file images ${file} --ids ${opts.ids}`])
				})
			},
		)

	cmd
		.command('images')
		.description(`Render nodes to image URLs. ${TIER_1_NOTE}`)
		.argument('<file>', 'File key, branch key, or Figma file URL')
		.requiredOption(
			'--ids <ids>',
			'Node ids to render in ONE call (comma-separated) — batching is how Figma says to avoid rate limits',
		)
		.option('--format <format>', `Image format: ${RENDER_FORMATS.join(', ')} (default: png)`, parseFormat)
		.option('--scale <number>', 'Render scale, 0.01–4', parseScale)
		.option('--version <id>', 'A specific version id (default: the current version)')
		.option('--svg-outline-text', 'Render text as vector paths instead of <text> elements')
		.option('--svg-include-id', 'Add the layer name to each element id attribute')
		.option('--svg-include-node-id', 'Add the node id to each element data-node-id attribute')
		.option('--svg-simplify-stroke', 'Use stroke attributes instead of <mask> where possible')
		.option('--contents-only', 'Exclude overlapping content')
		.option('--use-absolute-bounds', 'Use full node dimensions, ignoring cropping')
		.addHelpText(
			'after',
			'\nA null url means THAT node did not render (bad id, nothing renderable); the call\nitself succeeded, so retrying returns the same. Rendered URLs expire after 30 days.',
		)
		.action(
			async (
				file: string,
				opts: {
					ids: string
					format?: RenderFormat
					scale?: number
					version?: string
					svgOutlineText?: boolean
					svgIncludeId?: boolean
					svgIncludeNodeId?: boolean
					svgSimplifyStroke?: boolean
					contentsOnly?: boolean
					useAbsoluteBounds?: boolean
				},
			) => {
				const result = await getApi().images(file, opts.ids, {
					format: opts.format,
					scale: opts.scale,
					version: opts.version,
					svgOutlineText: opts.svgOutlineText,
					svgIncludeId: opts.svgIncludeId,
					svgIncludeNodeId: opts.svgIncludeNodeId,
					svgSimplifyStroke: opts.svgSimplifyStroke,
					contentsOnly: opts.contentsOnly,
					useAbsoluteBounds: opts.useAbsoluteBounds,
				})

				output(result, () => {
					printTable(
						result.images,
						[
							{ label: 'node_id', get: (image) => image.node_id },
							{ label: 'rendered', get: (image) => String(image.rendered) },
							{ label: 'url', get: (image) => image.url ?? '' },
						],
						{ entity: 'nodes' },
					)
					printCountSummary(result.rendered_count, 'image(s) rendered')
					if (result.failed_count > 0) {
						printSummary(
							`${result.failed_count} node(s) did not render: ${result.failed_node_ids.join(', ')} — that is a per-node outcome, not a failed call, so retrying returns the same.`,
						)
					}
					printSummary(
						`URLs expire ${result.url_expires_after_days} days after rendering — download what you need now.`,
					)
					printNextSteps([`cyber-figma file image-fills ${file}`])
				})
			},
		)

	cmd
		.command('image-fills')
		.description('Get download URLs for the user-supplied images used as fills in a file')
		.argument('<file>', 'File key, branch key, or Figma file URL')
		.addHelpText(
			'after',
			'\nThe imageRef keys match the imageRef on Paint objects in `file get` output.\nThese URLs expire sooner than rendered ones — after no more than 14 days.',
		)
		.action(async (file: string) => {
			const result = await getApi().imageFills(file)

			output(result, () => {
				printTable(
					result.images,
					[
						{ label: 'image_ref', get: (fill) => fill.image_ref },
						{ label: 'url', get: (fill) => fill.url },
					],
					{ entity: 'image fills' },
				)
				printCountSummary(result.count, 'image fill(s)')
				printSummary(`URLs expire after at most ${result.url_expires_after_days} days — download what you need now.`)
			})
		})

	cmd
		.command('meta')
		.description('Get file metadata without fetching the document — rate limit tier 3, the cheapest')
		.argument('<file>', 'File key, branch key, or Figma file URL')
		.action(async (file: string) => {
			const meta = await getApi().meta(file)

			output(meta, () => {
				printFields({
					name: meta.name,
					folder: meta.folder_name,
					editorType: meta.editorType,
					role: meta.role,
					link_access: meta.link_access,
					version: meta.version,
					last_touched_at: meta.last_touched_at,
					last_touched_by: meta.last_touched_by?.handle,
					creator: meta.creator?.handle,
					url: meta.url,
				})
				printNextSteps([`cyber-figma file versions ${file}`, `cyber-figma file get ${file}   # tier 1 — spends quota`])
			})
		})

	addPaginationOptions(
		cmd
			.command('versions')
			.description("Get a file's version history — rate limit tier 2")
			.argument('<file>', 'File key, branch key, or Figma file URL')
			.action(async (file: string, opts: PaginationCliOptions) => {
				const result = await getApi().versions(file, paginationOptionsFromCli(opts))

				output(result, () => {
					printTable(
						result.data,
						[
							{ label: 'id', get: (version) => version.id },
							{ label: 'created_at', get: (version) => version.created_at },
							{ label: 'label', get: (version) => truncate(version.label ?? '', { full: isFull(), limit: 40 }) },
							{ label: 'user', get: (version) => version.user?.handle ?? '' },
						],
						{ entity: 'versions' },
					)
					printCountSummary(result.count, 'version(s)')
					printNextPageHint(result, `cyber-figma file versions ${file}`)
					printNextSteps([`cyber-figma file get ${file} --version <id>   # tier 1 — spends quota`])
				})
			}),
		FILE_VERSION_PAGINATION,
	)

	return cmd
}
