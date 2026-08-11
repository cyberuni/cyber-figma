import { envValue } from './env.js'
import { teamIdFromInput } from './url.js'

// Figma provides no endpoint that discovers a team id from a token — its docs
// say so outright — so a team id is configuration, exactly as the workspace gid
// is for Asana. The one job here is that a missing one says where to get it.

let teamOverride: string | undefined
let repoConfigTeamId: string | undefined

/** The `--team` global flag, which outranks FIGMA_TEAM_ID. */
export function setTeamOverride(team: string | undefined) {
	teamOverride = team
}

/**
 * The team id from the repo's checked-in config — the last resort, so a
 * checked-out repo is self-describing without every contributor setting an env
 * var, while a contributor who does set one is deliberately overriding it.
 */
export function setRepoConfigTeamId(team: string | undefined) {
	repoConfigTeamId = team
}

const MISSING_TEAM_MESSAGE = `A Figma team id is required for this command.

Figma has no API that discovers a team id from a token, so it has to be
supplied. Open the team in Figma and copy the id that follows /team/ in the
URL: https://www.figma.com/files/team/<team-id>/<team-name>

Then either set it once:
  export FIGMA_TEAM_ID=<team-id>

or pass it per invocation (the id or the whole URL both work):
  cyber-figma --team <team-id> <command>

To fix it for everyone working in this repo, commit it to .agents/cyber-figma.json:
  { "schema_version": 1, "team_id": "<team-id>" }`

/**
 * The team id for this invocation: what the command was given, else the
 * `--team` flag, else `FIGMA_TEAM_ID`. A team URL is accepted anywhere an id
 * is, since the URL bar is where users get it from.
 */
export function optionalTeamId(explicit?: string): string | undefined {
	const value = explicit ?? teamOverride ?? envValue('FIGMA_TEAM_ID') ?? repoConfigTeamId
	return value ? teamIdFromInput(value) : undefined
}

export function requireTeamId(explicit?: string): string {
	const team = optionalTeamId(explicit)
	if (!team) throw new Error(MISSING_TEAM_MESSAGE)
	return team
}
