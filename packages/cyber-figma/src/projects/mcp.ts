import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { paginationOptions, paginationParams } from '../mcp-options.js'
import type { ProjectApi } from './api.js'
import { PROJECT_FILE_LIST_PAGINATION, PROJECT_LIST_PAGINATION } from './gateway.js'

const asText = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data) }] })

export function registerProjectTools(server: McpServer, getApi: () => ProjectApi) {
	server.tool(
		'figma_project_list',
		'List the projects of a Figma team. Start here: a team id leads to projects, projects to files, and a file to the file key every file tool takes.',
		{
			team: z.string().optional().describe('Team id or team URL (default: FIGMA_TEAM_ID)'),
			...paginationParams(PROJECT_LIST_PAGINATION),
		},
		async ({ team, ...page }) => asText(await getApi().list(team, paginationOptions(page))),
	)

	server.tool(
		'figma_project_get',
		'Read the metadata of a Figma project: name, file count, and when it was created and last updated',
		{ project: z.string().describe('Project id or project URL') },
		async ({ project }) => asText(await getApi().get(project)),
	)

	server.tool(
		'figma_project_files',
		'List the files in a Figma project, with the file key each file tool takes',
		{
			project: z.string().describe('Project id or project URL'),
			branch_data: z.boolean().optional().describe('Include branch metadata for each main file that has branches'),
			...paginationParams(PROJECT_FILE_LIST_PAGINATION),
		},
		async ({ project, branch_data, ...page }) =>
			asText(await getApi().files(project, { ...paginationOptions(page), branchData: branch_data })),
	)
}
