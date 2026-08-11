import type { LibraryFamily } from './gateway.js'

// The three published-library families, described once. Every layer — api
// hints, CLI descriptions, MCP tool descriptions — reads its nouns and its
// warnings from here, so the two facts that surprise users most (published-only
// content, and main-file-keys-only) are stated identically everywhere.

/**
 * The single most common misreading of these endpoints: a component that exists
 * in a file but was never published to a library is in none of these responses,
 * and the command looks broken rather than correct.
 */
export function publishedOnlyNote(resource: LibraryResource): string {
	return `Returns only PUBLISHED library ${resource.plural} — not every ${resource.label} in the file.`
}

/** Branches cannot publish, so a branch key is never the right key here. */
export const MAIN_FILE_KEY_NOTE = 'Must be a MAIN file key or URL, not a branch: branches cannot publish.'

/** The three scopes, which differ by the scope of access rather than by family. */
export const LIBRARY_SCOPES = {
	team: 'team_library_content:read',
	file: 'library_content:read',
	key: 'library_assets:read',
} as const

export type LibraryResource = {
	/** The DOMAINS name and the CLI noun. */
	domain: 'component' | 'component-set' | 'style'
	/** The middle word of this family's MCP tool names. */
	tool: 'component' | 'component_set' | 'style'
	/** The path segment and response key Figma uses. */
	family: LibraryFamily
	label: string
	plural: string
}

export const LIBRARY_RESOURCES: LibraryResource[] = [
	{ domain: 'component', tool: 'component', family: 'components', label: 'component', plural: 'components' },
	{
		domain: 'component-set',
		tool: 'component_set',
		family: 'component_sets',
		label: 'component set',
		plural: 'component sets',
	},
	{ domain: 'style', tool: 'style', family: 'styles', label: 'style', plural: 'styles' },
]
