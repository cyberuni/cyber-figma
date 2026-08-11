import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
	DEFAULT_CONFIG_RELATIVE_PATH,
	parseRepoConfig,
	readRepoConfig,
	repoConfigPath,
	writeRepoConfig,
} from './repo-config.js'

async function tempRepo() {
	return mkdtemp(join(tmpdir(), 'cyber-figma-repo-'))
}

describe('repoConfigPath', () => {
	it('is .agents/cyber-figma.json inside the repo', () => {
		expect(repoConfigPath('/repo')).toBe(join('/repo', DEFAULT_CONFIG_RELATIVE_PATH))
	})
})

describe('parseRepoConfig', () => {
	it('accepts a config carrying a team id', () => {
		expect(parseRepoConfig({ schema_version: 1, team_id: '1234' })).toEqual({ schema_version: 1, team_id: '1234' })
	})

	it('accepts a config with no team id', () => {
		expect(parseRepoConfig({ schema_version: 1 })).toEqual({ schema_version: 1 })
	})

	it('rejects a schema version it does not understand', () => {
		expect(() => parseRepoConfig({ schema_version: 2 })).toThrowError(/schema_version/)
		expect(() => parseRepoConfig({})).toThrowError(/schema_version/)
	})

	it('rejects a non-object', () => {
		expect(() => parseRepoConfig('nope')).toThrowError(/JSON object/)
	})

	it('rejects a team id that is not a string', () => {
		expect(() => parseRepoConfig({ schema_version: 1, team_id: 1234 })).toThrowError(/team_id/)
	})
})

describe('readRepoConfig', () => {
	it('reports no config when the repo has none', async () => {
		expect(await readRepoConfig(await tempRepo())).toBeUndefined()
	})

	it('reads a config the repo does have', async () => {
		const repo = await tempRepo()
		await mkdir(join(repo, '.agents'), { recursive: true })
		await writeFile(repoConfigPath(repo), JSON.stringify({ schema_version: 1, team_id: '1234' }))

		expect(await readRepoConfig(repo)).toEqual({ schema_version: 1, team_id: '1234' })
	})

	// A malformed config must name itself; a silent undefined here reads as "no
	// config" and sends the user hunting for the wrong thing.
	it('names the file when its contents are not valid JSON', async () => {
		const repo = await tempRepo()
		await mkdir(join(repo, '.agents'), { recursive: true })
		await writeFile(repoConfigPath(repo), '{ not json')

		await expect(readRepoConfig(repo)).rejects.toThrowError(/cyber-figma\.json/)
	})
})

describe('writeRepoConfig', () => {
	it('creates the directory and round-trips through readRepoConfig', async () => {
		const repo = await tempRepo()
		await writeRepoConfig(repo, { schema_version: 1, team_id: '1234' })

		expect(await readRepoConfig(repo)).toEqual({ schema_version: 1, team_id: '1234' })
	})

	it('writes newline-terminated json so the file is diff-friendly', async () => {
		const repo = await tempRepo()
		await writeRepoConfig(repo, { schema_version: 1, team_id: '1234' })

		expect(await readFile(repoConfigPath(repo), 'utf8')).toMatch(/\n$/)
	})
})
