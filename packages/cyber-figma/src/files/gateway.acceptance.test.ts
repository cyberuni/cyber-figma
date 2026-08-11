import { describe } from 'vitest'
import type { FigmaClient, FigmaRequest } from '../client.js'
import { defineListPaginationAcceptanceSpecs } from '../testing/list-pagination.acceptance.js'
import { createPaginatingClient } from '../testing/paginating-gateway.js'
import { defineFileGatewayAcceptanceSpecs } from './gateway.acceptance.js'
import { createFigmaFileGateway, FILE_VERSION_PAGINATION } from './gateway.js'

const FILE_KEY = 'abc123'
const NODE_ID = '1:2'
const UNRENDERABLE_NODE_ID = '999999:999999'

/**
 * A double routing by path, because these specs call the endpoints in whatever
 * order vitest runs them in. It honors `unwrap` the way the real client does,
 * so the image-fills envelope is exercised rather than assumed.
 */
function createFileClient(): FigmaClient {
	const bodies: Record<string, unknown> = {
		[`/v1/files/${FILE_KEY}`]: {
			name: 'Design',
			role: 'owner',
			lastModified: '2026-08-01T00:00:00Z',
			editorType: 'figma',
			version: '123',
			document: { id: '0:0', name: 'Document', type: 'DOCUMENT', children: [] },
			components: {},
			componentSets: {},
			styles: {},
			schemaVersion: 0,
		},
		[`/v1/files/${FILE_KEY}/nodes`]: {
			name: 'Design',
			nodes: { [NODE_ID]: { document: { id: NODE_ID, name: 'Frame', type: 'FRAME' } } },
		},
		[`/v1/images/${FILE_KEY}`]: {
			err: null,
			// Figma returns a key for every requested id; null means that node did
			// not render, not that the call failed.
			images: { [NODE_ID]: 'https://figma-alpha-api.s3.amazonaws.com/rendered', [UNRENDERABLE_NODE_ID]: null },
		},
		[`/v1/files/${FILE_KEY}/images`]: { error: false, status: 200, meta: { images: { 'ref-1': 'https://fill' } } },
		[`/v1/files/${FILE_KEY}/meta`]: {
			file: { name: 'Design', last_touched_at: '2026-08-01T00:00:00Z', editorType: 'figma', creator: { id: 'u' } },
		},
	}

	return {
		authMode: 'personal',
		async request<T = unknown>(spec: FigmaRequest): Promise<T> {
			const body = bodies[spec.path]
			if (body === undefined) throw new Error(`no fixture for ${spec.path}`)
			if (spec.unwrap === 'meta' && body && typeof body === 'object' && 'meta' in body) {
				return (body as { meta: T }).meta
			}
			return body as T
		},
	}
}

describe(
	'file gateway',
	defineFileGatewayAcceptanceSpecs({
		gateway: createFigmaFileGateway(createFileClient()),
		fileKey: FILE_KEY,
		nodeId: NODE_ID,
		unrenderableNodeId: UNRENDERABLE_NODE_ID,
	}),
)

/**
 * The paginating double picks its page from pagination options, and a gateway
 * puts them on the wire as query parameters — so this reads them back off the
 * request, which is exactly what Figma does with them.
 */
function createVersionClient(pages: unknown[][]): FigmaClient {
	const inner = createPaginatingClient(FILE_VERSION_PAGINATION, pages)
	return {
		authMode: 'personal',
		async request<T = unknown>(spec: FigmaRequest): Promise<T> {
			const query = spec.query ?? {}
			return (await inner.request(spec, {
				after: query.after as string | undefined,
				before: query.before as string | undefined,
			})) as T
		},
	}
}

describe(
	'file version list',
	defineListPaginationAcceptanceSpecs({
		model: 'url_page',
		list: (opts) =>
			createFigmaFileGateway(createVersionClient([[{ id: '1' }], [{ id: '2' }], [{ id: '3' }]])).listVersions(
				FILE_KEY,
				opts,
			),
	}),
)
