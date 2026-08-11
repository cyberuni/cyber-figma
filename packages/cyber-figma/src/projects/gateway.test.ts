import { describe, expect, it } from 'vitest'
import { createRecordingClient } from '../testing/paginating-gateway.js'
import { createFigmaProjectGateway } from './gateway.js'

describe('listTeamProjects', () => {
	it('asks Figma for the projects of a team', async () => {
		const client = createRecordingClient([{ name: 'Design', projects: [] }])

		await createFigmaProjectGateway(client).listTeamProjects('1234')

		expect(client.requests[0]).toMatchObject({ method: 'GET', path: '/v1/teams/1234/projects' })
	})
})

describe('getProjectMeta', () => {
	it('asks Figma for the metadata of a project', async () => {
		const client = createRecordingClient([{ id: '55', name: 'Website', file_count: 3 }])

		await createFigmaProjectGateway(client).getProjectMeta('55')

		expect(client.requests[0]).toMatchObject({ method: 'GET', path: '/v1/projects/55/meta' })
	})
})

describe('listProjectFiles', () => {
	it('asks Figma for the files of a project', async () => {
		const client = createRecordingClient([{ name: 'Website', files: [] }])

		await createFigmaProjectGateway(client).listProjectFiles('55')

		expect(client.requests[0]).toMatchObject({ method: 'GET', path: '/v1/projects/55/files' })
	})

	it('asks for branch metadata only when it was requested', async () => {
		const client = createRecordingClient([
			{ name: 'Website', files: [] },
			{ name: 'Website', files: [] },
		])
		const gateway = createFigmaProjectGateway(client)

		await gateway.listProjectFiles('55')
		await gateway.listProjectFiles('55', { branchData: true })

		expect(client.requests[0].query?.branch_data).toBeUndefined()
		expect(client.requests[1].query?.branch_data).toBe(true)
	})
})
