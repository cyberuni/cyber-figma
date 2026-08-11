import { describe } from 'vitest'
import { createRuntimeContext } from '../composition.js'
import { isSystemTestEnabled, requireSystemEnv, systemEnv } from '../testing/system.js'
import type { CommentApi } from './api.js'
import { defineCommentAcceptanceSpecs } from './gateway.acceptance.js'

// The same acceptance factory the double runs, against the live Figma API. It
// needs a real file the credential can read: FIGMA_TEST_FILE_KEY, which accepts
// a file key or a pasted Figma file URL.
//
// The write specs post and delete real comments in that file, so they are opt-in
// again behind FIGMA_TEST_COMMENT_WRITES. Everything they create is deleted at
// the end of the spec that created it, and Figma allows only the author to
// delete a comment — so run it against a file you own.

const enabled = isSystemTestEnabled() && Boolean(systemEnv('FIGMA_TEST_FILE_KEY'))

describe.skipIf(!enabled)('the comments domain against the live API', () => {
	const specs = defineCommentAcceptanceSpecs({
		api: () => createRuntimeContext().api<CommentApi>('comment'),
		file: enabled ? requireSystemEnv('FIGMA_TEST_FILE_KEY') : '',
		includeWrites: Boolean(systemEnv('FIGMA_TEST_COMMENT_WRITES')),
	})
	specs()
})
