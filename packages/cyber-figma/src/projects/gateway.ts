import type { FigmaClient } from '../client.js'
import type { GetProjectFilesResponse, GetProjectMetaResponse, GetTeamProjectsResponse } from '../figma-types.js'
import type { PaginationSpec } from '../pagination.js'

/** GET team projects returns every project the caller can see, in one response. */
export const PROJECT_LIST_PAGINATION: PaginationSpec = { model: 'none', itemsKey: 'projects' }

/** GET project files returns every file in the project, in one response. */
export const PROJECT_FILE_LIST_PAGINATION: PaginationSpec = { model: 'none', itemsKey: 'files' }

export type ProjectFile = GetProjectFilesResponse['files'][number] & {
	/**
	 * What `branch_data=true` adds per main file. The OpenAPI spec declares the
	 * query parameter but omits the field it produces from the response type, and
	 * Figma's prose does not spell the entries out either, so it stays unnamed
	 * here rather than being invented. It survives into `--json` output intact.
	 */
	branches?: unknown[]
}

export type ProjectFilesResponse = Omit<GetProjectFilesResponse, 'files'> & { files: ProjectFile[] }

// Projects are the discovery path: a team id (the one identifier Figma cannot
// hand you) leads to projects, projects lead to files, and a file leads to a
// file key. All three endpoints are read-only and return everything at once.

export type ProjectGateway = {
	listTeamProjects: (teamId: string) => Promise<GetTeamProjectsResponse>
	getProjectMeta: (projectId: string) => Promise<GetProjectMetaResponse>
	listProjectFiles: (projectId: string, opts?: { branchData?: boolean }) => Promise<ProjectFilesResponse>
}

export function createFigmaProjectGateway(client: FigmaClient): ProjectGateway {
	return {
		listTeamProjects: (teamId) =>
			client.request({ method: 'GET', path: `/v1/teams/${encodeURIComponent(teamId)}/projects` }),
		getProjectMeta: (projectId) =>
			client.request({ method: 'GET', path: `/v1/projects/${encodeURIComponent(projectId)}/meta` }),
		listProjectFiles: (projectId, opts) =>
			client.request({
				method: 'GET',
				path: `/v1/projects/${encodeURIComponent(projectId)}/files`,
				query: { branch_data: opts?.branchData },
			}),
	}
}
