import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

const run = promisify(execFile)
const CLI = fileURLToPath(new URL('./cli.ts', import.meta.url))
// The local tsx binary, not `npx tsx` — npx writes notices to stderr, which is
// where the structured error output under test lives.
const TSX = fileURLToPath(new URL('../node_modules/.bin/tsx', import.meta.url))

/** Run the real CLI the way an agent would, with a clean credential environment. */
async function cli(args: string[], env: Record<string, string> = {}) {
	const child = { ...process.env, FIGMA_ACCESS_TOKEN: '', FIGMA_TOKEN: '', FIGMA_TEAM_ID: '', FIGMA_TEAM: '', ...env }
	try {
		const { stdout, stderr } = await run(TSX, [CLI, ...args], { env: child })
		return { code: 0, stdout, stderr }
	} catch (error) {
		const failure = error as { code?: number; stdout?: string; stderr?: string }
		return { code: failure.code ?? 1, stdout: failure.stdout ?? '', stderr: failure.stderr ?? '' }
	}
}

describe('cyber-figma cli', () => {
	// AXI principle 8: no arguments shows live state, not a usage manual.
	it('shows configuration and available resources when run with no arguments', async () => {
		const { code, stdout } = await cli([])

		expect(code).toBe(0)
		expect(stdout).toContain('cyber-figma')
		expect(stdout).toContain('auth')
		expect(stdout).toContain('not configured')
	})

	it('emits the home view as JSON when asked', async () => {
		const { code, stdout } = await cli(['--json'])
		const parsed = JSON.parse(stdout)

		expect(code).toBe(0)
		expect(parsed.description).toContain('Figma')
		expect(parsed.auth.configured).toBe(false)
	})

	it('never prints the token', async () => {
		const { stdout } = await cli(['--json'], { FIGMA_ACCESS_TOKEN: 'secret-token' })

		expect(stdout).not.toContain('secret-token')
		expect(JSON.parse(stdout).auth.configured).toBe(true)
	})

	it('reports the version', async () => {
		expect((await cli(['--version'])).code).toBe(0)
	})

	// AXI principle 6: an unknown flag is a usage error with exit code 2, and the
	// valid flags come back inline so it self-corrects in one turn.
	it('rejects an unknown flag with exit code 2 and lists the valid ones', async () => {
		const { code, stderr } = await cli(['--nope'])

		expect(code).toBe(2)
		expect(stderr).toContain("unknown option '--nope'")
		expect(stderr).toContain('--toon')
	})

	it('rejects an unknown subcommand with exit code 2', async () => {
		expect((await cli(['definitely-not-a-resource'])).code).toBe(2)
	})

	it('renders a usage error structurally when --json is set', async () => {
		const { code, stderr } = await cli(['--json', '--nope'])

		expect(code).toBe(2)
		expect(JSON.parse(stderr).error.kind).toBe('usage')
	})

	it('exits 0 on --help', async () => {
		const { code, stdout } = await cli(['--help'])

		expect(code).toBe(0)
		expect(stdout).toContain('--auth-mode')
		expect(stdout).toContain('Exit codes')
	})
})
