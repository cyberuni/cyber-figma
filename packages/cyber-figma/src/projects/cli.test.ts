import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaginatedResult } from '../pagination.js'
import type { ProjectApi } from './api.js'
import { projectCommand } from './cli.js'

function page<T>(data: T[]): PaginatedResult<T> {
	return {
		data,
		count: data.length,
		next_cursor: null,
		prev_cursor: null,
		pagination_model: 'none',
		page_count: 1,
		truncated: false,
	}
}

const api: ProjectApi = {
	list: async () => page([{ id: '55', name: 'Website' }]),
	get: async () => ({
		id: '55',
		name: 'Website',
		thumbnail_url: null,
		file_count: 2,
		updated_at: '2026-02-01T00:00:00Z',
		created_at: '2026-01-01T00:00:00Z',
	}),
	files: async () => page([{ key: 'abc123', name: 'Home', last_modified: '2026-02-01T00:00:00Z' }]),
}

let printed: string[]

beforeEach(() => {
	printed = []
	vi.spyOn(console, 'log').mockImplementation((line?: unknown) => {
		printed.push(String(line))
	})
})

afterEach(() => {
	vi.restoreAllMocks()
})

const run = (args: string[], overrides: Partial<ProjectApi> = {}) =>
	projectCommand(() => ({ ...api, ...overrides })).parseAsync(args, { from: 'user' })

const output = () => printed.join('\n')

describe('project list', () => {
	it('lists projects with the id every other project command takes', async () => {
		await run(['list'])

		expect(output()).toContain('55')
		expect(output()).toContain('Website')
	})

	it('points at the files of a project, which is where file keys come from', async () => {
		await run(['list'])

		expect(output()).toContain('cyber-figma project files 55')
	})

	it('names what was empty when a team has no projects', async () => {
		await run(['list'], { list: async () => page([]) })

		expect(output()).toContain('0 projects found')
	})
})

describe('project files', () => {
	it('lists file keys and points at the file commands that take them', async () => {
		await run(['files', '55'])

		expect(output()).toContain('abc123')
		expect(output()).toContain('cyber-figma file get abc123')
	})

	it('names what was empty when a project has no files', async () => {
		await run(['files', '55'], { files: async () => page([]) })

		expect(output()).toContain('0 files found')
	})
})

describe('project get', () => {
	it('shows the project metadata, including how many files to expect', async () => {
		await run(['get', '55'])

		expect(output()).toContain('Website')
		expect(output()).toContain('2')
	})
})
