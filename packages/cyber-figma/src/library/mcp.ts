import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { paginationOptions, paginationParams } from '../mcp-options.js'
import type { LibraryApi } from './api.js'
import { libraryTeamListPagination } from './gateway.js'
import { LIBRARY_SCOPES, type LibraryResource, MAIN_FILE_KEY_NOTE, publishedOnlyNote } from './resources.js'

// Three tools per family, named `figma_<resource>_<action>`. The descriptions
// carry the two facts an agent cannot recover from an empty result: these
// endpoints see published library content only, and each scope of access needs
// its own OAuth scope.

const text = (result: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(result) }] })

export function registerLibraryTools(server: McpServer, resource: LibraryResource, getApi: () => LibraryApi) {
	const published = publishedOnlyNote(resource)

	server.tool(
		`figma_${resource.tool}_team_list`,
		`List a team's published library ${resource.plural}. ${published} Scope required: ${LIBRARY_SCOPES.team}.`,
		{
			team: z.string().optional().describe('Team id or team URL — defaults to the configured FIGMA_TEAM_ID'),
			...paginationParams(libraryTeamListPagination(resource.family)),
		},
		async ({ team, ...page }) => text(await getApi().listByTeam(team, paginationOptions(page))),
	)

	server.tool(
		`figma_${resource.tool}_file_list`,
		`List the published library ${resource.plural} of one file. ${published} Scope required: ${LIBRARY_SCOPES.file}.`,
		{
			file: z.string().describe(`File key or Figma file URL. ${MAIN_FILE_KEY_NOTE}`),
		},
		async ({ file }) => text(await getApi().listByFile(file)),
	)

	server.tool(
		`figma_${resource.tool}_get`,
		`Get one published library ${resource.label} by its key. ${published} Scope required: ${LIBRARY_SCOPES.key}.`,
		{
			key: z.string().describe(`Library key of the published ${resource.label} — not a node id`),
		},
		async ({ key }) => text(await getApi().get(key)),
	)
}
