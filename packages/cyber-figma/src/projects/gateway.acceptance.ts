import { expect, it } from 'vitest'
import type { ProjectApi } from './api.js'

// The contract the projects domain owes, independent of whether it is talking
// to a double or to Figma. It is written as the walk an agent actually makes —
// team → projects → project → files → file key — because that walk is the
// reason this domain exists.

export type ProjectAcceptanceDeps = {
	/** Built lazily: a live context needs a credential, which collection time must not require. */
	api: () => ProjectApi
	/** The team to list. Omitted means "whatever the environment is configured with". */
	team?: string
}

export function defineProjectAcceptanceSpecs(deps: ProjectAcceptanceDeps) {
	const list = () => deps.api().list(deps.team)

	return () => {
		it('lists the projects of a team as id/name pairs', async () => {
			const result = await list()

			expect(result.pagination_model).toBe('none')
			for (const project of result.data) {
				expect(typeof project.id).toBe('string')
				expect(typeof project.name).toBe('string')
			}
		})

		it('reads the metadata of a project the team listing named', async (ctx) => {
			const [project] = (await list()).data
			if (!project) return ctx.skip()

			const meta = await deps.api().get(project.id)

			expect(meta.id).toBe(project.id)
			expect(meta.name).toBe(project.name)
			expect(typeof meta.file_count).toBe('number')
		})

		it('walks from a project to file keys, which is what every file command takes', async (ctx) => {
			const [project] = (await list()).data
			if (!project) return ctx.skip()

			const files = await deps.api().files(project.id)

			expect(files.count).toBe(files.data.length)
			for (const file of files.data) {
				expect(typeof file.key).toBe('string')
				expect(file.key.length).toBeGreaterThan(0)
				expect(typeof file.name).toBe('string')
			}
		})

		it('accepts a project URL wherever it accepts a project id', async (ctx) => {
			const [project] = (await list()).data
			if (!project) return ctx.skip()

			const url = `https://www.figma.com/files/team/1234/project/${project.id}/Example`

			expect((await deps.api().get(url)).id).toBe(project.id)
		})
	}
}
