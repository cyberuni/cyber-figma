import { describe } from 'vitest'
import type { FigmaClient, FigmaRequest } from '../client.js'
import { defineListPaginationAcceptanceSpecs } from '../testing/list-pagination.acceptance.js'
import { createProjectApi } from './api.js'
import { defineProjectAcceptanceSpecs } from './gateway.acceptance.js'
import { createFigmaProjectGateway } from './gateway.js'

// A stand-in Figma with one team, one project, and one file — enough to run the
// same walk the live suite runs, without a credential. It answers by path
// rather than by call order, because the acceptance specs walk the graph and so
// make the same request more than once.
const RESPONSES: Record<string, unknown> = {
	'/v1/teams/1234/projects': { name: 'Design', projects: [{ id: '55', name: 'Website' }] },
	'/v1/projects/55/meta': {
		id: '55',
		name: 'Website',
		thumbnail_url: null,
		file_count: 1,
		updated_at: '2026-02-01T00:00:00Z',
		created_at: '2026-01-01T00:00:00Z',
	},
	'/v1/projects/55/files': {
		name: 'Website',
		files: [{ key: 'abc123', name: 'Home', last_modified: '2026-02-01T00:00:00Z' }],
	},
}

function fakeFigma(): FigmaClient {
	return {
		authMode: 'personal',
		async request<T = unknown>(request: FigmaRequest): Promise<T> {
			const body = RESPONSES[request.path]
			if (body === undefined) throw new Error(`fakeFigma: no fixture for ${request.method} ${request.path}`)
			return body as T
		},
	}
}

const api = () => createProjectApi(createFigmaProjectGateway(fakeFigma()))

describe('project domain', defineProjectAcceptanceSpecs({ api, team: '1234' }))

describe(
	'project list',
	defineListPaginationAcceptanceSpecs({
		model: 'none',
		list: (opts) => api().list('1234', opts),
	}),
)

describe(
	'project files',
	defineListPaginationAcceptanceSpecs({
		model: 'none',
		list: (opts) => api().files('55', opts),
	}),
)
