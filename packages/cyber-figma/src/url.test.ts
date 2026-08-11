import { describe, expect, it } from 'vitest'
import { fileKeyFromInput, normalizeNodeIds, parseFigmaUrl, teamIdFromInput } from './url.js'

describe('parseFigmaUrl file keys', () => {
	it('reads the file key from a legacy /file/ URL', () => {
		const parsed = parseFigmaUrl('https://www.figma.com/file/abc123XYZ/My-Design')
		expect(parsed.kind).toBe('file')
		expect(parsed.file_key).toBe('abc123XYZ')
	})

	it('reads the file key from a current /design/ URL', () => {
		const parsed = parseFigmaUrl('https://www.figma.com/design/abc123XYZ/My-Design')
		expect(parsed.kind).toBe('design')
		expect(parsed.file_key).toBe('abc123XYZ')
	})

	it('reads the file key from FigJam, prototype, slides, and deck URLs', () => {
		for (const segment of ['board', 'proto', 'slides', 'deck']) {
			const parsed = parseFigmaUrl(`https://www.figma.com/${segment}/key9/Title`)
			expect(parsed.kind).toBe(segment)
			expect(parsed.file_key).toBe('key9')
		}
	})

	it('reads the file key when the URL has no title segment', () => {
		expect(parseFigmaUrl('https://www.figma.com/design/abc123').file_key).toBe('abc123')
	})

	it('accepts figma.com without the www subdomain', () => {
		expect(parseFigmaUrl('https://figma.com/design/abc123/Title').file_key).toBe('abc123')
	})

	it('accepts the Figma for Government host', () => {
		expect(parseFigmaUrl('https://www.figma-gov.com/design/abc123/Title').file_key).toBe('abc123')
	})

	it('does not read a file key out of a look-alike host', () => {
		const parsed = parseFigmaUrl('https://notfigma.com/design/abc123/Title')
		expect(parsed.kind).toBe('unknown')
		expect(parsed.file_key).toBeNull()
	})
})

describe('parseFigmaUrl node ids', () => {
	it('normalizes the URL dash form of a node id to the API colon form', () => {
		expect(parseFigmaUrl('https://www.figma.com/design/abc/T?node-id=1-23').node_id).toBe('1:23')
	})

	it('accepts a percent-encoded colon in node-id', () => {
		expect(parseFigmaUrl('https://www.figma.com/design/abc/T?node-id=1%3A23').node_id).toBe('1:23')
	})

	it('normalizes every separator in an instance node id', () => {
		expect(parseFigmaUrl('https://www.figma.com/design/abc/T?node-id=I1-23;4-56').node_id).toBe('I1:23;4:56')
	})

	it('reports no node id when the URL carries none', () => {
		expect(parseFigmaUrl('https://www.figma.com/design/abc/T').node_id).toBeNull()
	})
})

describe('fileKeyFromInput', () => {
	it('returns a bare file key unchanged', () => {
		expect(fileKeyFromInput('abc123XYZ')).toBe('abc123XYZ')
	})

	it('extracts the file key from a URL', () => {
		expect(fileKeyFromInput('https://www.figma.com/design/abc123XYZ/My-Design')).toBe('abc123XYZ')
	})

	it('rejects a figma URL that names no file', () => {
		expect(() => fileKeyFromInput('https://www.figma.com/files/team/123/Name')).toThrowError(/file key/)
	})

	it('rejects an empty input', () => {
		expect(() => fileKeyFromInput('   ')).toThrowError(/required/)
	})
})

describe('normalizeNodeIds', () => {
	it('normalizes and trims a comma-separated list', () => {
		expect(normalizeNodeIds('1-23, 4-5 ,6:7')).toEqual(['1:23', '4:5', '6:7'])
	})

	it('drops empty entries', () => {
		expect(normalizeNodeIds('1-23,,')).toEqual(['1:23'])
	})
})

describe('parseFigmaUrl team, project, and org ids', () => {
	it('reads a team id from a /files/team/ URL', () => {
		const parsed = parseFigmaUrl('https://www.figma.com/files/team/1234567890/Design-Team')
		expect(parsed.kind).toBe('team')
		expect(parsed.team_id).toBe('1234567890')
		expect(parsed.org_id).toBeNull()
	})

	it('reads a team id from a bare /team/ URL', () => {
		expect(parseFigmaUrl('https://www.figma.com/team/1234567890').team_id).toBe('1234567890')
	})

	it('reads the org id that precedes the team segment', () => {
		const parsed = parseFigmaUrl('https://www.figma.com/files/998877/team/1234/Design-Team')
		expect(parsed.org_id).toBe('998877')
		expect(parsed.team_id).toBe('1234')
	})

	it('reads a project id and reports project as the more specific kind', () => {
		const parsed = parseFigmaUrl('https://www.figma.com/files/team/1234/project/5678/Sprint')
		expect(parsed.kind).toBe('project')
		expect(parsed.project_id).toBe('5678')
		expect(parsed.team_id).toBe('1234')
	})

	it('reports no ids for a file URL', () => {
		const parsed = parseFigmaUrl('https://www.figma.com/design/abc/T')
		expect(parsed.team_id).toBeNull()
		expect(parsed.project_id).toBeNull()
	})
})

describe('teamIdFromInput', () => {
	it('returns a bare team id unchanged', () => {
		expect(teamIdFromInput('1234567890')).toBe('1234567890')
	})

	it('extracts the team id from a team URL', () => {
		expect(teamIdFromInput('https://www.figma.com/files/team/1234567890/Design-Team')).toBe('1234567890')
	})

	it('rejects a figma URL that names no team', () => {
		expect(() => teamIdFromInput('https://www.figma.com/design/abc/T')).toThrowError(/team id/)
	})
})
