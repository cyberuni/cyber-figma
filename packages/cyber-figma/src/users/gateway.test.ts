import { describe, expect, it } from 'vitest'
import { createRecordingClient } from '../testing/paginating-gateway.js'
import { createFigmaUserGateway } from './gateway.js'

describe('me', () => {
	it('asks Figma who the credential belongs to', async () => {
		const client = createRecordingClient([{ id: '1', handle: 'ada', img_url: '', email: 'ada@example.com' }])

		await createFigmaUserGateway(client).me()

		expect(client.requests[0]).toMatchObject({ method: 'GET', path: '/v1/me' })
	})

	it('reports which credential mode it is running under, because /v1/me is mode-gated', () => {
		expect(createFigmaUserGateway(createRecordingClient([])).authMode).toBe('personal')
	})
})
