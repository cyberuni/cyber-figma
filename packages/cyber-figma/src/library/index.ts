import { type AnyDomain, defineDomain } from '../composition.js'
import { createLibraryApi } from './api.js'
import { libraryCommand } from './cli.js'
import { createFigmaLibraryGateway } from './gateway.js'
import { registerLibraryTools } from './mcp.js'
import { LIBRARY_RESOURCES } from './resources.js'

// Three domains out of one implementation: components, component sets, and
// styles are the same three endpoints over three path segments, so each family
// gets its own CLI noun and its own tool names while sharing every layer.

export const LIBRARY_DOMAINS: AnyDomain[] = LIBRARY_RESOURCES.map((resource) =>
	defineDomain({
		name: resource.domain,
		createApi: (client) => createLibraryApi(createFigmaLibraryGateway(client, resource.family), resource),
		command: (getApi) => libraryCommand(resource, getApi),
		registerTools: (server, getApi) => registerLibraryTools(server, resource, getApi),
	}),
)
