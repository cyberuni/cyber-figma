import { Command } from 'commander'
import { output, printFields, printNextSteps } from '../output.js'
import type { UserApi } from './api.js'

export function userCommand(getApi: () => UserApi): Command {
	const cmd = new Command('user').description('The Figma account the current credential belongs to')

	cmd
		.command('me')
		.description('Show the current user — the connection check for a personal or OAuth credential')
		.action(async () => {
			const me = await getApi().me()
			output(me, () => {
				printFields({ id: me.id, handle: me.handle, email: me.email, image: me.img_url })
				// Knowing who you are does not tell you which team to walk: Figma has
				// no endpoint that discovers a team id, so point at where it comes from.
				printNextSteps(['cyber-figma project list --team <team-id>'])
			})
		})

	return cmd
}
