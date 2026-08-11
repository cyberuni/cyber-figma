import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Command } from 'commander'
import { activityLogDomain } from './activity-logs/index.js'
import { aiUsageDomain } from './ai-usage/index.js'
import { analyticsDomain } from './analytics/index.js'
import { createClient, type FigmaClient } from './client.js'
import { commentDomain } from './comments/index.js'
import { devResourceDomain } from './dev-resources/index.js'
import { developerLogDomain } from './developer-logs/index.js'
import { discoveryDomain } from './discovery/index.js'
import { fileDomain } from './files/index.js'
import { LIBRARY_DOMAINS } from './library/index.js'
import { oembedDomain } from './oembed/index.js'
import { paymentDomain } from './payments/index.js'
import { projectDomain } from './projects/index.js'
import { userDomain } from './users/index.js'
import { variableDomain } from './variables/index.js'
import { webhookDomain } from './webhooks/index.js'

// Where the domains are wired in. A domain owns its gateway, api, CLI bindings,
// and MCP registrations together (Screaming Architecture); this module is the
// only place that knows all of them exist, and adding one is a single entry in
// the DOMAINS list below.
//
// See src/README-for-domain-pods.md for the worked skeleton.

export type DomainModule<Api> = {
	/** The CLI resource noun and the middle word of every tool name: `file` → `figma_file_get`. */
	name: string
	createApi: (client: FigmaClient) => Api
	command: (getApi: () => Api) => Command
	registerTools: (server: McpServer, getApi: () => Api) => void
}

/** A domain with its api type erased, so one list can hold all of them. */
export type AnyDomain = DomainModule<never>

/**
 * Register a domain. The api type stays checked inside the domain — its own
 * `command` and `registerTools` see the real type — and is erased at this
 * boundary so composition does not have to name every domain's api type.
 */
export function defineDomain<Api>(module: DomainModule<Api>): AnyDomain {
	return module as unknown as AnyDomain
}

/**
 * Every Figma resource domain this build ships.
 *
 * Domain pods: add your module here, and add your `api.js` / `gateway.js`
 * exports to index.ts. Nothing else in the spine changes.
 */
export const DOMAINS: AnyDomain[] = [
	activityLogDomain,
	aiUsageDomain,
	analyticsDomain,
	commentDomain,
	devResourceDomain,
	developerLogDomain,
	discoveryDomain,
	fileDomain,
	oembedDomain,
	...LIBRARY_DOMAINS,
	paymentDomain,
	projectDomain,
	userDomain,
	variableDomain,
	webhookDomain,
]

export type RuntimeContext = {
	client: FigmaClient
	/** The api of one domain, built on first use and reused afterwards. */
	api: <Api = unknown>(name: string) => Api
	domains: AnyDomain[]
}

export type RuntimeContextOptions = {
	client?: FigmaClient
	domains?: AnyDomain[]
}

export function createRuntimeContext(options: RuntimeContextOptions = {}): RuntimeContext {
	const client = options.client ?? createClient()
	const domains = options.domains ?? DOMAINS
	// A CLI invocation touches one domain. Building every api eagerly would pay
	// for all of them — including their gateways — on every single run.
	const built = new Map<string, unknown>()

	return {
		client,
		domains,
		api<Api = unknown>(name: string): Api {
			if (!built.has(name)) {
				const domain = domains.find((candidate) => candidate.name === name)
				if (!domain) throw new Error(`No Figma domain named "${name}" is registered`)
				built.set(name, domain.createApi(client))
			}
			return built.get(name) as Api
		},
	}
}

/**
 * The context is resolved when a command runs, not when it is registered, so
 * `--help` and usage errors never need a credential.
 */
export function registerCliCommands(
	program: Command,
	getContext: () => RuntimeContext,
	domains: AnyDomain[] = DOMAINS,
) {
	for (const domain of domains) {
		program.addCommand(domain.command(() => getContext().api(domain.name) as never))
	}
}

export function registerMcpTools(server: McpServer, getContext: () => RuntimeContext, domains: AnyDomain[] = DOMAINS) {
	for (const domain of domains) {
		domain.registerTools(server, () => getContext().api(domain.name) as never)
	}
}
