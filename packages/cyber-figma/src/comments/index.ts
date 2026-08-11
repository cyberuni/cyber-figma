import { defineDomain } from '../composition.js'
import { createCommentApi } from './api.js'
import { commentCommand } from './cli.js'
import { createFigmaCommentGateway } from './gateway.js'
import { registerCommentTools } from './mcp.js'

export const commentDomain = defineDomain({
	name: 'comment',
	// The auth mode reaches the api because every write here needs
	// file_comments:write, which plan access tokens do not carry.
	createApi: (client) => createCommentApi(createFigmaCommentGateway(client), { authMode: client.authMode }),
	command: commentCommand,
	registerTools: registerCommentTools,
})
