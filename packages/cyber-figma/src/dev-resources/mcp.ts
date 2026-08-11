import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { paginationOptions, paginationParams } from '../mcp-options.js'
import type { DevResourceApi } from './api.js'
import { DEV_RESOURCE_LIST_PAGINATION } from './gateway.js'

const FILE = z.string().describe('File key or Figma file URL — a MAIN file, not a branch')

/**
 * The write tools say what a 200 does not: these two endpoints report per-item
 * failures in the body, and the result names how many of the requested items
 * actually landed.
 */
const PARTIAL_SUCCESS_NOTE =
	'Figma answers this endpoint with 200 even when some items fail — read ok, succeeded, failed, and errors in the result.'

function json(result: unknown) {
	return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
}

export function registerDevResourceTools(server: McpServer, getApi: () => DevResourceApi) {
	server.tool(
		'figma_dev_resource_list',
		'List the Dev Mode resources (developer links) attached to nodes in a Figma file',
		{
			file: FILE,
			node_ids: z.string().optional().describe('Comma-separated node ids; omit for every dev resource in the file'),
			...paginationParams(DEV_RESOURCE_LIST_PAGINATION),
		},
		async ({ file, node_ids, ...page }) =>
			json(await getApi().list(file, { nodeIds: node_ids, ...paginationOptions(page) })),
	)

	server.tool(
		'figma_dev_resource_create',
		`Attach developer links to nodes, across one or more files in a single call. ${PARTIAL_SUCCESS_NOTE}`,
		{
			resources: z
				.array(
					z.object({
						file: FILE,
						node_id: z.string().describe('Node to attach the link to'),
						name: z.string().describe('Display name of the link'),
						url: z.string().describe('URL the link points at'),
					}),
				)
				.describe('The links to create. A node holds at most 10, and their URLs must differ'),
		},
		async ({ resources }) =>
			json(
				await getApi().create(
					resources.map((resource) => ({
						file: resource.file,
						nodeId: resource.node_id,
						name: resource.name,
						url: resource.url,
					})),
				),
			),
	)

	server.tool(
		'figma_dev_resource_update',
		`Rename developer links or point them at different URLs, in a single call. ${PARTIAL_SUCCESS_NOTE}`,
		{
			resources: z
				.array(
					z.object({
						id: z.string().describe('Dev resource id, from figma_dev_resource_list'),
						name: z.string().optional().describe('New display name'),
						url: z.string().optional().describe('New URL'),
					}),
				)
				.describe('The changes to apply'),
		},
		async ({ resources }) => json(await getApi().update(resources)),
	)

	server.tool(
		'figma_dev_resource_delete',
		'Remove a developer link from a Figma file',
		{
			file: FILE,
			dev_resource_id: z.string().describe('Dev resource id, from figma_dev_resource_list'),
		},
		async ({ file, dev_resource_id }) => json(await getApi().remove(file, dev_resource_id)),
	)
}
