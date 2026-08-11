import { describe, expect, it } from 'vitest'
import { createRecordingClient } from '../testing/paginating-gateway.js'
import { createFigmaOEmbedGateway } from './gateway.js'

const EMBED = { version: '1.0', type: 'rich', title: 'Home', url: 'https://www.figma.com/design/abc123/Home' }

describe('get', () => {
	it('asks Figma to describe the URL as an oEmbed resource', async () => {
		const client = createRecordingClient([EMBED])

		await createFigmaOEmbedGateway(client).get({ url: 'https://www.figma.com/design/abc123/Home' })

		expect(client.requests[0]).toMatchObject({
			method: 'GET',
			path: '/v1/oembed',
			query: { url: 'https://www.figma.com/design/abc123/Home' },
		})
	})

	it('sends the embed dimensions only when they were asked for', async () => {
		const client = createRecordingClient([EMBED, EMBED])
		const gateway = createFigmaOEmbedGateway(client)

		await gateway.get({ url: 'https://www.figma.com/design/abc123/Home' })
		await gateway.get({ url: 'https://www.figma.com/design/abc123/Home', maxWidth: 1200, maxHeight: 675 })

		expect(client.requests[0].query?.maxwidth).toBeUndefined()
		expect(client.requests[1].query).toMatchObject({ maxwidth: 1200, maxheight: 675 })
	})
})
