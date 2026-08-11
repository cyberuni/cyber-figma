import { describe } from 'vitest'
import type { FigmaClient } from '../client.js'
import { createRuntimeContext } from '../composition.js'
import { defineListPaginationAcceptanceSpecs } from '../testing/list-pagination.acceptance.js'
import { isSystemTestEnabled, systemEnv } from '../testing/system.js'
import { normalizeNodeId } from '../url.js'
import { defineFileGatewayAcceptanceSpecs } from './gateway.acceptance.js'
import { createFigmaFileGateway } from './gateway.js'

// The same acceptance factories the unit suites run against doubles, run
// against Figma.
//
// ⚠️ Cost: `get`, `getNodes`, and `renderImages` are Figma's tier-1 endpoints,
// and a View or Collab seat is allowed roughly six tier-1 calls per month on
// every plan. This suite spends several of them per run, so it is gated on its
// own env vars and stays off by default.

const fileKey = systemEnv('FIGMA_FILE_KEY')
const nodeId = systemEnv('FIGMA_NODE_ID')
const enabled = isSystemTestEnabled() && Boolean(fileKey) && Boolean(nodeId)

// Well-formed and vanishingly unlikely to exist: Figma answers 200 with null
// for it, which is the node-level-failure contract these specs pin down.
const UNRENDERABLE_NODE_ID = '999999:999999'

/**
 * Vitest evaluates a skipped suite's body to collect it, so the real client is
 * built on the first request rather than at collection — otherwise a
 * contributor with no credential sees this suite fail instead of skip.
 */
function lazyClient(): FigmaClient {
	let client: FigmaClient | undefined
	const resolve = () => (client ??= createRuntimeContext().client)
	return {
		get authMode() {
			return resolve().authMode
		},
		request: (spec) => resolve().request(spec),
	}
}

describe.skipIf(!enabled)('file gateway (live)', () => {
	const gateway = createFigmaFileGateway(lazyClient())

	describe(
		'contract',
		defineFileGatewayAcceptanceSpecs({
			gateway,
			fileKey: fileKey ?? '',
			nodeId: normalizeNodeId(nodeId ?? ''),
			unrenderableNodeId: UNRENDERABLE_NODE_ID,
		}),
	)

	describe(
		'version list',
		defineListPaginationAcceptanceSpecs({
			model: 'url_page',
			list: (opts) => gateway.listVersions(fileKey ?? '', { pageSize: 2, ...opts }),
			// A file with a single version cannot demonstrate a second page, and
			// which file the credential points at is not ours to choose.
			includeMultiPage: false,
		}),
	)
})
