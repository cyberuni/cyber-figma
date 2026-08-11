import { afterEach, describe, expect, it } from 'vitest'
import { setTeamOverride } from '../scope.js'
import { createRecordingClient } from '../testing/paginating-gateway.js'
import { createProjectApi } from './api.js'
import { createFigmaProjectGateway } from './gateway.js'

function api(responses: unknown[]) {
	const client = createRecordingClient(responses)
	return { client, api: createProjectApi(createFigmaProjectGateway(client)) }
}

afterEach(() => {
	setTeamOverride(undefined)
})

describe('list', () => {
	it('lists the projects of the configured team', async () => {
		setTeamOverride('1234')
		const { client, api: projects } = api([{ name: 'Design', projects: [{ id: '55', name: 'Website' }] }])

		const result = await projects.list()

		expect(client.requests[0].path).toBe('/v1/teams/1234/projects')
		expect(result.data).toEqual([{ id: '55', name: 'Website' }])
	})

	it('takes a team URL where a team id is taken', async () => {
		const { client, api: projects } = api([{ name: 'Design', projects: [] }])

		await projects.list('https://www.figma.com/files/team/1234/Design')

		expect(client.requests[0].path).toBe('/v1/teams/1234/projects')
	})

	it('says where to find a team id when none is configured', async () => {
		delete process.env.FIGMA_TEAM_ID
		delete process.env.FIGMA_TEAM
		const { api: projects } = api([])

		await expect(projects.list()).rejects.toThrowError(/team id/i)
	})
})

describe('get', () => {
	it('reads the metadata of a project', async () => {
		const { client, api: projects } = api([{ id: '55', name: 'Website', file_count: 3 }])

		const meta = await projects.get('55')

		expect(client.requests[0].path).toBe('/v1/projects/55/meta')
		expect(meta.name).toBe('Website')
	})

	it('takes the project URL a user copies from the URL bar', async () => {
		const { client, api: projects } = api([{ id: '55', name: 'Website' }])

		await projects.get('https://www.figma.com/files/team/1234/project/55/Website')

		expect(client.requests[0].path).toBe('/v1/projects/55/meta')
	})

	it('refuses a Figma URL that names no project', async () => {
		const { api: projects } = api([])

		await expect(projects.get('https://www.figma.com/files/team/1234/Design')).rejects.toThrowError(/project id/i)
	})
})

describe('files', () => {
	it('lists the files of a project', async () => {
		const { client, api: projects } = api([
			{ name: 'Website', files: [{ key: 'abc', name: 'Home', last_modified: '2026-01-01T00:00:00Z' }] },
		])

		const result = await projects.files('55')

		expect(client.requests[0].path).toBe('/v1/projects/55/files')
		expect(result.data).toHaveLength(1)
	})

	it('asks for branch metadata when it was requested', async () => {
		const { client, api: projects } = api([{ name: 'Website', files: [] }])

		await projects.files('55', { branchData: true })

		expect(client.requests[0].query?.branch_data).toBe(true)
	})
})
