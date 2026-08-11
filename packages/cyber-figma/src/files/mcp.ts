import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { paginationOptions, paginationParams } from '../mcp-options.js'
import type { FileApi } from './api.js'
import { FILE_VERSION_PAGINATION } from './gateway.js'

// The tool descriptions carry the cost warnings, because an agent picks its
// tool from the description alone: three of these are Figma's tier-1 endpoints,
// where a View or Collab seat gets roughly six calls per month.

const TIER_1 =
	'COSTLY: rate limit tier 1 — a View or Collab seat gets roughly 6 tier-1 calls per MONTH. Use figma_file_meta for listing and inspection.'

const file = z.string().describe('File key, branch key, or Figma file URL')
const ids = z.string().describe('Comma-separated node ids; dashed URL ids like 1-2 are accepted')
const version = z.string().optional().describe('A specific version id (default: the current version)')
const depth = z
	.union([z.number().int().min(1), z.literal('all')])
	.optional()
	.describe('Tree depth: 1 = pages, 2 = pages and their top-level objects, "all" = the whole tree')
const geometry = z.literal('paths').optional().describe('Set to "paths" to include vector geometry')
const pluginData = z.string().optional().describe('Comma-separated plugin ids and/or the string "shared"')

function json(result: unknown) {
	return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
}

export function registerFileTools(server: McpServer, getApi: () => FileApi) {
	server.tool(
		'figma_file_get',
		`Get a Figma file's document tree. With neither ids nor depth this returns pages only (depth 1). ${TIER_1}`,
		{
			file,
			ids: ids.optional(),
			depth,
			version,
			geometry,
			plugin_data: pluginData,
			branch_data: z.boolean().optional().describe('Include branch metadata — the only way to obtain a branch key'),
		},
		async ({ file, ids, depth, version, geometry, plugin_data, branch_data }) =>
			json(
				await getApi().get(file, { ids, depth, version, geometry, pluginData: plugin_data, branchData: branch_data }),
			),
	)

	server.tool(
		'figma_file_nodes',
		`Get the document of specific nodes in a Figma file. ${TIER_1}`,
		{ file, ids, depth, version, geometry, plugin_data: pluginData },
		async ({ file, ids, depth, version, geometry, plugin_data }) =>
			json(await getApi().nodes(file, ids, { depth, version, geometry, pluginData: plugin_data })),
	)

	server.tool(
		'figma_file_images',
		`Render Figma nodes to image URLs. Pass EVERY node id in one call — batching is how Figma says to avoid rate limits. A null url means THAT node did not render (the call still succeeded), and URLs expire after 30 days. ${TIER_1}`,
		{
			file,
			ids: ids.describe('Comma-separated node ids to render in ONE call; dashed URL ids like 1-2 are accepted'),
			format: z.enum(['jpg', 'png', 'svg', 'pdf']).optional().describe('Image format (default: png)'),
			scale: z.number().min(0.01).max(4).optional().describe('Render scale, 0.01–4'),
			version,
			svg_outline_text: z.boolean().optional().describe('Render text as vector paths instead of <text> elements'),
			svg_include_id: z.boolean().optional().describe('Add the layer name to each element id attribute'),
			svg_include_node_id: z.boolean().optional().describe('Add the node id to each element data-node-id attribute'),
			svg_simplify_stroke: z.boolean().optional().describe('Use stroke attributes instead of <mask> where possible'),
			contents_only: z.boolean().optional().describe('Exclude overlapping content'),
			use_absolute_bounds: z.boolean().optional().describe('Use full node dimensions, ignoring cropping'),
		},
		async ({ file, ids, format, scale, version, ...svg }) =>
			json(
				await getApi().images(file, ids, {
					format,
					scale,
					version,
					svgOutlineText: svg.svg_outline_text,
					svgIncludeId: svg.svg_include_id,
					svgIncludeNodeId: svg.svg_include_node_id,
					svgSimplifyStroke: svg.svg_simplify_stroke,
					contentsOnly: svg.contents_only,
					useAbsoluteBounds: svg.use_absolute_bounds,
				}),
			),
	)

	server.tool(
		'figma_file_image_fills',
		'Get download URLs for the user-supplied images used as fills in a Figma file. The imageRef keys match imageRef on Paint objects in figma_file_get output. These URLs expire after at most 14 days.',
		{ file },
		async ({ file }) => json(await getApi().imageFills(file)),
	)

	server.tool(
		'figma_file_meta',
		'Get Figma file metadata — name, project, editor type, role, link access, and when it was last touched — without fetching the document. Rate limit tier 3, the cheapest: prefer this for listing and inspection.',
		{ file },
		async ({ file }) => json(await getApi().meta(file)),
	)

	server.tool(
		'figma_file_versions',
		"Get a Figma file's version history. Rate limit tier 2.",
		{ file, ...paginationParams(FILE_VERSION_PAGINATION) },
		async ({ file, ...page }) => json(await getApi().versions(file, paginationOptions(page))),
	)
}
