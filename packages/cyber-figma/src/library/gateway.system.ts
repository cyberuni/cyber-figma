import { describe, expect, it } from 'vitest'
import { createRuntimeContext } from '../composition.js'
import { isSystemTestEnabled, systemEnv } from '../testing/system.js'
import { defineLibraryAcceptanceSpecs } from './gateway.acceptance.js'
import { createFigmaLibraryGateway, type PublishedLibraryItem } from './gateway.js'
import { LIBRARY_RESOURCES } from './resources.js'

// The same acceptance factory the unit suite runs against doubles, against the
// live API. It needs a team and a MAIN file key that actually publishes a
// library — an unpublished file is a legitimate empty answer here, which the
// contract tolerates but which would prove nothing.

const teamId = systemEnv('FIGMA_TEAM_ID')
const fileKey = systemEnv('FIGMA_LIBRARY_FILE_KEY')
const enabled = isSystemTestEnabled() && Boolean(teamId) && Boolean(fileKey)

if (enabled) {
	const { client } = createRuntimeContext()

	for (const resource of LIBRARY_RESOURCES) {
		const gateway = createFigmaLibraryGateway<PublishedLibraryItem>(client, resource.family)

		describe(`${resource.family} gateway (live)`, () => {
			defineLibraryAcceptanceSpecs<PublishedLibraryItem>({
				family: resource.family,
				gateway,
				teamId: teamId as string,
				fileKey: fileKey as string,
				// A live library rarely has more than one page of 30, and a second page
				// cannot be fabricated — set FIGMA_LIBRARY_MULTIPAGE=1 on an account
				// whose team library is bigger than one page.
				includeMultiPage: systemEnv('FIGMA_LIBRARY_MULTIPAGE') === '1',
			})()

			// The by-key read needs a key only Figma can supply, so it is discovered
			// rather than configured. An unpublished file simply has nothing to read.
			it('reads back a published item by the key the file list returned', async () => {
				const published = (await gateway.listByFile(fileKey as string)).data[0]
				if (!published) return

				expect((await gateway.get(published.key)).key).toBe(published.key)
			})
		})
	}
} else {
	describe.skip('library gateway (live)', () => {
		it('needs FIGMA_SYSTEM_TEST, FIGMA_ACCESS_TOKEN, FIGMA_TEAM_ID, and FIGMA_LIBRARY_FILE_KEY', () => {})
	})
}
