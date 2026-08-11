import { describe } from 'vitest'
import { createRuntimeContext } from '../composition.js'
import { isSystemTestEnabled, systemEnv } from '../testing/system.js'
import type { OEmbedApi } from './api.js'
import { defineOEmbedAcceptanceSpecs } from './gateway.acceptance.js'
import { oembedDomain } from './index.js'

// oEmbed needs a URL the credential can actually see, and there is no endpoint
// that discovers one — so this suite takes it from the environment and skips
// itself without one. The credential must be personal or OAuth: a plan access
// token cannot reach this endpoint at all.
const url = systemEnv('FIGMA_OEMBED_URL')
const enabled = isSystemTestEnabled() && Boolean(url)

const api = () => createRuntimeContext({ domains: [oembedDomain] }).api<OEmbedApi>('oembed')

describe.skipIf(!enabled)('oembed domain (live)', defineOEmbedAcceptanceSpecs({ api, url: url ?? '' }))
