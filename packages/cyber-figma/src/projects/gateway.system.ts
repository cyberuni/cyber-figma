import { describe } from 'vitest'
import { createRuntimeContext } from '../composition.js'
import { defineListPaginationAcceptanceSpecs } from '../testing/list-pagination.acceptance.js'
import { isSystemTestEnabled, systemEnv } from '../testing/system.js'
import type { ProjectApi } from './api.js'
import { defineProjectAcceptanceSpecs } from './gateway.acceptance.js'
import { projectDomain } from './index.js'

// The same contract the acceptance suite runs against doubles, run against the
// live API. It additionally needs FIGMA_TEAM_ID, because Figma has no endpoint
// that discovers a team id from a token — so it skips itself without one rather
// than failing a build that simply has not configured a team.
const team = systemEnv('FIGMA_TEAM_ID')
const enabled = isSystemTestEnabled() && Boolean(team)

// Built per call, and never at collection time: creating a client requires a
// credential, and this file is collected even when the suite is skipped.
const api = () => createRuntimeContext({ domains: [projectDomain] }).api<ProjectApi>('project')

describe.skipIf(!enabled)('project domain (live)', () => {
	describe('contract', defineProjectAcceptanceSpecs({ api, team }))

	describe(
		'project list',
		defineListPaginationAcceptanceSpecs({
			model: 'none',
			list: (opts) => api().list(team, opts),
		}),
	)
})
