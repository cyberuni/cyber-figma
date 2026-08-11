import { describe } from 'vitest'
import { createRuntimeContext } from '../composition.js'
import { isSystemTestEnabled } from '../testing/system.js'
import type { UserApi } from './api.js'
import { defineUserAcceptanceSpecs } from './gateway.acceptance.js'
import { userDomain } from './index.js'

// The same contract the acceptance suite runs against doubles, run against the
// live API. It needs no extra configuration beyond the credential — but that
// credential must be personal or OAuth, since /v1/me refuses plan tokens.
const api = () => createRuntimeContext({ domains: [userDomain] }).api<UserApi>('user')

describe.skipIf(!isSystemTestEnabled())('user domain (live)', defineUserAcceptanceSpecs({ api }))
