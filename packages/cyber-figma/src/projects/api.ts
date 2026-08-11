import type { GetProjectMetaResponse, Project } from '../figma-types.js'
import { collectPages, type PaginatedResult, type PaginationOptions } from '../pagination.js'
import { requireTeamId } from '../scope.js'
import { parseFigmaUrl } from '../url.js'
import {
	PROJECT_FILE_LIST_PAGINATION,
	PROJECT_LIST_PAGINATION,
	type ProjectFile,
	type ProjectGateway,
} from './gateway.js'

const IS_URL = /^[a-z][a-z0-9+.-]*:\/\//i

/**
 * A project id from either a bare id or the project URL. Figma exposes no
 * endpoint that discovers a project id, so the URL bar is where a user gets one
 * — the same reason `fileKeyFromInput` and `teamIdFromInput` exist.
 */
function projectIdFromInput(input: string): string {
	const trimmed = input.trim()
	if (!trimmed) throw new Error('A Figma project id or project URL is required')
	if (!IS_URL.test(trimmed)) return trimmed

	const parsed = parseFigmaUrl(trimmed)
	if (!parsed.project_id) {
		throw new Error(`No project id in URL: ${trimmed} — expected a figma.com /files/team/<id>/project/<id>/… link`)
	}
	return parsed.project_id
}

export type ProjectApi = {
	list: (team?: string, opts?: PaginationOptions) => Promise<PaginatedResult<Project>>
	get: (project: string) => Promise<GetProjectMetaResponse>
	files: (project: string, opts?: PaginationOptions & { branchData?: boolean }) => Promise<PaginatedResult<ProjectFile>>
}

export function createProjectApi(gateway: ProjectGateway): ProjectApi {
	return {
		// `async` rather than a sync throw: a missing team id must reach the caller
		// as a rejected promise like every other failure, not as a throw at call time.
		list: async (team, opts) => {
			const teamId = requireTeamId(team)
			return collectPages<Project>(PROJECT_LIST_PAGINATION, () => gateway.listTeamProjects(teamId), opts)
		},
		get: async (project) => gateway.getProjectMeta(projectIdFromInput(project)),
		files: async (project, opts) => {
			const projectId = projectIdFromInput(project)
			return collectPages<ProjectFile>(
				PROJECT_FILE_LIST_PAGINATION,
				() => gateway.listProjectFiles(projectId, { branchData: opts?.branchData }),
				opts,
			)
		},
	}
}
