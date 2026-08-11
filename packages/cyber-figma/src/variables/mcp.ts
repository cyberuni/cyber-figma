import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { paginationOptions, paginationParams } from '../mcp-options.js'
import type { VariableApi } from './api.js'
import { VARIABLE_LIST_PAGINATION } from './gateway.js'

// Every tool here needs an Enterprise plan — reading included, which is the part
// that surprises people. Each description says so, because a client that reads
// the tool list is deciding whether to call at all.

const ENTERPRISE = 'Requires an Enterprise plan (reads as well as writes).'

const file = z.string().describe('File key or Figma file URL')
const published = z
	.boolean()
	.optional()
	.describe('Read the published library variables instead of the local ones. Needs a main file key, not a branch')

const json = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data) }] })

export function registerVariableTools(server: McpServer, getApi: () => VariableApi) {
	server.tool(
		'figma_variable_list',
		`List the variables in a Figma file. The local view is the only place mode values are readable. ${ENTERPRISE}`,
		{
			file,
			published,
			collection_id: z.string().optional().describe('Only the variables in this variable collection'),
			...paginationParams(VARIABLE_LIST_PAGINATION),
		},
		async ({ file: fileInput, published: publishedView, collection_id, ...page }) =>
			json(
				await getApi().list(fileInput, {
					published: publishedView,
					collectionId: collection_id,
					...paginationOptions(page),
				}),
			),
	)

	server.tool(
		'figma_variable_collection_list',
		`List the variable collections in a Figma file, with their modes. The published view omits modes. ${ENTERPRISE}`,
		{ file, published, ...paginationParams(VARIABLE_LIST_PAGINATION) },
		async ({ file: fileInput, published: publishedView, ...page }) =>
			json(await getApi().collections(fileInput, { published: publishedView, ...paginationOptions(page) })),
	)

	server.tool(
		'figma_variable_get',
		`Show one variable by id — how to resolve the variableId a node carries in boundVariables. ${ENTERPRISE}`,
		{
			file,
			variable_id: z.string().describe('Variable id, e.g. VariableID:1:2'),
			published,
		},
		async ({ file: fileInput, variable_id, published: publishedView }) =>
			json(await getApi().get(fileInput, variable_id, { published: publishedView })),
	)

	server.tool(
		'figma_variable_apply',
		[
			'Create, update, and delete variables, collections, modes, and mode values in one batch request.',
			'The arrays are applied in this order: variableCollections, variableModes, variables, variableModeValues.',
			'A CREATE may carry a temporary id that later entries reference; the response maps those to real ids.',
			'Changes are visible only in this file until the library is published, which the REST API cannot do.',
			`${ENTERPRISE} Writing also needs a Full seat or admin and Edit access on the file, and is not reachable with a plan access token.`,
		].join(' '),
		{
			file,
			changes: z
				.object({
					variableCollections: z.array(z.record(z.string(), z.unknown())).optional(),
					variableModes: z.array(z.record(z.string(), z.unknown())).optional(),
					variables: z.array(z.record(z.string(), z.unknown())).optional(),
					variableModeValues: z.array(z.record(z.string(), z.unknown())).optional(),
				})
				.describe('The change set. Entries in the first three arrays carry an action of CREATE, UPDATE, or DELETE'),
			dry_run: z
				.boolean()
				.optional()
				.describe('Validate the change set and report what it would touch, without sending it'),
		},
		async ({ file: fileInput, changes, dry_run }) =>
			dry_run ? json({ ...getApi().validate(changes), dry_run: true }) : json(await getApi().apply(fileInput, changes)),
	)
}
