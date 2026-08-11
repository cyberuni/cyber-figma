import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

// A repo-local, committable config. It exists for one reason: Figma has no API
// that discovers a team id from a token, so without this every contributor to a
// repo has to be told the team id out of band and set it in their own
// environment. Checking it in makes the repo self-describing.
//
// Environment variables still win over it, so a contributor can point the tool
// at a different team for one shell without editing a tracked file.

export const DEFAULT_CONFIG_RELATIVE_PATH = join('.agents', 'cyber-figma.json')

export type RepoConfig = {
	schema_version: 1
	/** The team id team-scoped commands default to. A team URL is not accepted here; store the id. */
	team_id?: string
}

export function repoConfigPath(repoRoot: string): string {
	return join(repoRoot, DEFAULT_CONFIG_RELATIVE_PATH)
}

export function parseRepoConfig(raw: unknown): RepoConfig {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		throw new Error('Repo config must be a JSON object')
	}
	const record = raw as Record<string, unknown>
	if (record.schema_version !== 1) {
		throw new Error('Unsupported or missing schema_version in repo config; expected 1')
	}
	if (record.team_id !== undefined && typeof record.team_id !== 'string') {
		throw new Error('Repo config team_id must be a string')
	}
	return {
		schema_version: 1,
		...(record.team_id !== undefined && { team_id: record.team_id as string }),
	}
}

/**
 * The repo's config, or undefined when it has none. A config that exists but is
 * malformed throws naming the file — reporting it as "no config" would send the
 * reader hunting for the wrong thing.
 */
export async function readRepoConfig(repoRoot: string): Promise<RepoConfig | undefined> {
	const path = repoConfigPath(repoRoot)
	let contents: string
	try {
		contents = await readFile(path, 'utf8')
	} catch {
		return undefined
	}
	try {
		return parseRepoConfig(JSON.parse(contents))
	} catch (error) {
		throw new Error(`Invalid repo config at ${path}: ${error instanceof Error ? error.message : String(error)}`)
	}
}

export async function writeRepoConfig(repoRoot: string, config: RepoConfig): Promise<string> {
	const path = repoConfigPath(repoRoot)
	await mkdir(dirname(path), { recursive: true })
	await writeFile(path, `${JSON.stringify(config, null, '\t')}\n`, 'utf8')
	return path
}
