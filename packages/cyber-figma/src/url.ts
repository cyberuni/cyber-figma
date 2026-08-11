// Figma URL parsing. File keys, node ids, team ids, and project ids are not
// discoverable from the API — the only place a user can get them is the URL bar
// (Figma says so explicitly for team ids), so every domain that takes one of
// these accepts a URL and comes through here.

export type FigmaUrlKind = 'file' | 'design' | 'board' | 'proto' | 'slides' | 'deck' | 'team' | 'project' | 'unknown'

export type ParsedFigmaUrl = {
	kind: FigmaUrlKind
	url: string
	file_key: string | null
	node_id: string | null
	team_id: string | null
	project_id: string | null
	org_id: string | null
}

const FILE_SEGMENTS = new Set(['file', 'design', 'board', 'proto', 'slides', 'deck'])
const FIGMA_HOSTS = ['figma.com', 'figma-gov.com']
const NUMERIC_ID = /^\d+$/

function isFigmaHost(hostname: string): boolean {
	return FIGMA_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))
}

function empty(kind: FigmaUrlKind, url: string): ParsedFigmaUrl {
	return { kind, url, file_key: null, node_id: null, team_id: null, project_id: null, org_id: null }
}

/** The id following a `/team/` or `/project/` marker anywhere in the path. */
function idAfter(segments: string[], marker: string): string | null {
	const at = segments.indexOf(marker)
	const value = at === -1 ? undefined : segments[at + 1]
	return value && NUMERIC_ID.test(value) ? value : null
}

/**
 * The org id, which Figma puts directly after `/files/` — but only there, and
 * only when it is not one of the `/files/team/…`, `/files/project/…` markers.
 */
function orgId(segments: string[]): string | null {
	if (segments[0] !== 'files') return null
	const candidate = segments[1]
	return candidate && NUMERIC_ID.test(candidate) ? candidate : null
}

export function parseFigmaUrl(input: string): ParsedFigmaUrl {
	const url = input.trim()
	if (!url) throw new Error('URL is required')

	let parsed: URL
	try {
		parsed = new URL(url)
	} catch {
		return empty('unknown', url)
	}
	if (!isFigmaHost(parsed.hostname)) return empty('unknown', url)

	const segments = parsed.pathname.split('/').filter(Boolean)
	const [head, key] = segments

	if (FILE_SEGMENTS.has(head) && key) {
		const nodeId = parsed.searchParams.get('node-id')
		return {
			...empty(head as FigmaUrlKind, url),
			file_key: key,
			node_id: nodeId ? normalizeNodeId(nodeId) : null,
		}
	}

	const teamId = idAfter(segments, 'team')
	const projectId = idAfter(segments, 'project')
	if (teamId || projectId) {
		// A project URL still carries its team; naming the kind `project` reports
		// the most specific thing the URL identifies.
		return {
			...empty(projectId ? 'project' : 'team', url),
			team_id: teamId,
			project_id: projectId,
			org_id: orgId(segments),
		}
	}

	return empty('unknown', url)
}

/**
 * A node id as the URL bar spells it (`1-23`) versus as the API takes it
 * (`1:23`). Figma swaps `:` for `-` in URLs; no node id contains a literal `-`,
 * so the substitution is unambiguous in both directions. Instance ids like
 * `I1-23;4-56` carry several separators and all of them move.
 */
export function normalizeNodeId(value: string): string {
	return value.trim().replaceAll('-', ':')
}

/** A comma-separated `--ids` value, normalized to the API's node id form. */
export function normalizeNodeIds(value: string): string[] {
	return value
		.split(',')
		.map((entry) => normalizeNodeId(entry))
		.filter((entry) => entry.length > 0)
}

function isUrl(value: string): boolean {
	return /^[a-z][a-z0-9+.-]*:\/\//i.test(value)
}

/**
 * A file key from either a bare key or any Figma file URL. Agents paste URLs;
 * scripts pass keys. Both are accepted everywhere a file key is taken.
 */
export function fileKeyFromInput(input: string): string {
	const trimmed = input.trim()
	if (!trimmed) throw new Error('A Figma file key or file URL is required')
	if (!isUrl(trimmed)) return trimmed

	const parsed = parseFigmaUrl(trimmed)
	if (!parsed.file_key) {
		throw new Error(`No file key in URL: ${trimmed} — expected a figma.com /file/ or /design/ link`)
	}
	return parsed.file_key
}

/** A team id from either a bare id or the team URL a user copies from the URL bar. */
export function teamIdFromInput(input: string): string {
	const trimmed = input.trim()
	if (!trimmed) throw new Error('A Figma team id or team URL is required')
	if (!isUrl(trimmed)) return trimmed

	const parsed = parseFigmaUrl(trimmed)
	if (!parsed.team_id) {
		throw new Error(`No team id in URL: ${trimmed} — expected a figma.com /files/team/<id>/… link`)
	}
	return parsed.team_id
}
