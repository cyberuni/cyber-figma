import { describe } from 'vitest'
import { createRuntimeContext } from '../composition.js'
import { isSystemTestEnabled, systemEnv } from '../testing/system.js'
import type { VariableApi } from './api.js'
import { defineVariableAcceptanceSpecs } from './gateway.acceptance.js'

// The same acceptance specs the doubles run, against the live API.
//
// Variables is Enterprise-gated on read as well as write, so this suite needs
// more than a token: it needs an Enterprise file the credential can see, named
// in FIGMA_VARIABLES_FILE_KEY. Without it every read here would 403 — which is
// the correct answer from Figma and a useless one as a test result — so the
// suite skips instead. Most contributors will never run it, and the doubles are
// where this domain is actually held to its contract.
//
// Writes are gated a second time, on FIGMA_VARIABLES_WRITE. `POST variables`
// mutates a real design file and the REST API has no publish or undo, so
// opting into a live read must not opt into a live write.

const fileKey = systemEnv('FIGMA_VARIABLES_FILE_KEY')
const write = Boolean(process.env.FIGMA_VARIABLES_WRITE)

describe.skipIf(!isSystemTestEnabled() || !fileKey)('variables domain (live)', () => {
	const api = () => createRuntimeContext().api<VariableApi>('variable')

	defineVariableAcceptanceSpecs({
		api,
		file: () => fileKey as string,
		includeMutations: write,
	})()
})
