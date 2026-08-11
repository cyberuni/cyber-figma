import type { GetFileMetaResponse, GetFileNodesResponse, GetFileResponse, Version } from '../figma-types.js'
import type { PaginatedResult, PaginationOptions } from '../pagination.js'
import { fileKeyFromInput, normalizeNodeIds } from '../url.js'
import type { FileGateway, NodeTreeOptions, RenderOptions } from './gateway.js'

// The operations the CLI and the MCP server both call. This is also where the
// cost of the Files domain is shaped: `get`, `nodes`, and `images` are Figma's
// tier-1 endpoints, and a View or Collab seat is allowed roughly six tier-1
// calls per month on every plan.

/** Figma expires a rendered image URL after this many days. */
export const RENDER_URL_EXPIRY_DAYS = 30
/** Image-fill URLs expire sooner than rendered ones — no more than this. */
export const IMAGE_FILL_URL_EXPIRY_DAYS = 14

const MIN_SCALE = 0.01
const MAX_SCALE = 4

/** `depth: 'all'` is the explicit way to ask for the whole tree, which is unbounded. */
export type FileGetOptions = Omit<NodeTreeOptions, 'depth'> & {
	ids?: string
	depth?: number | 'all'
	branchData?: boolean
}

export type FileNodesOptions = Omit<NodeTreeOptions, 'depth'> & { depth?: number | 'all' }

export type FileRenderOptions = Omit<RenderOptions, 'scale'> & { scale?: number }

export type RenderedImage = {
	node_id: string
	url: string | null
	/**
	 * False means *this node* did not render — a bad id or nothing renderable.
	 * The call itself succeeded, so re-requesting it will fail the same way.
	 */
	rendered: boolean
}

export type RenderResult = {
	images: RenderedImage[]
	rendered_count: number
	failed_count: number
	failed_node_ids: string[]
	url_expires_after_days: number
}

export type ImageFill = { image_ref: string; url: string }

export type ImageFillResult = {
	images: ImageFill[]
	count: number
	url_expires_after_days: number
}

export type FileMeta = GetFileMetaResponse['file']

export type FileApi = {
	get: (file: string, opts?: FileGetOptions) => Promise<GetFileResponse>
	nodes: (file: string, ids: string, opts?: FileNodesOptions) => Promise<GetFileNodesResponse>
	images: (file: string, ids: string, opts?: FileRenderOptions) => Promise<RenderResult>
	imageFills: (file: string) => Promise<ImageFillResult>
	meta: (file: string) => Promise<FileMeta>
	versions: (file: string, opts?: PaginationOptions) => Promise<PaginatedResult<Version>>
}

/** `all` means "send no depth", which is what Figma reads as the whole tree. */
function depthParam(depth: number | 'all' | undefined): number | undefined {
	return depth === undefined || depth === 'all' ? undefined : depth
}

function requireNodeIds(ids: string, operation: string): string[] {
	const parsed = normalizeNodeIds(ids)
	if (parsed.length === 0) {
		throw new Error(`${operation} needs at least one node id — pass --ids <id[,id…]> or a Figma URL's node-id`)
	}
	return parsed
}

function requireValidScale(scale: number | undefined): void {
	if (scale === undefined) return
	if (!(scale >= MIN_SCALE && scale <= MAX_SCALE)) {
		throw new Error(`scale must be between ${MIN_SCALE} and ${MAX_SCALE}, got ${scale}`)
	}
}

export function createFileApi(gateway: FileGateway): FileApi {
	return {
		get: (file, opts = {}) => {
			const ids = opts.ids ? normalizeNodeIds(opts.ids) : undefined
			// Neither narrowed nor bounded means "the entire document", which is the
			// most expensive thing this API can be asked for. Pages only is the
			// smallest answer that still tells a caller what the file contains.
			const depth = opts.depth === undefined && ids === undefined ? 1 : depthParam(opts.depth)
			return gateway.get(fileKeyFromInput(file), { ...opts, ids, depth })
		},

		nodes: async (file, ids, opts = {}) =>
			gateway.getNodes(fileKeyFromInput(file), requireNodeIds(ids, 'file nodes'), {
				...opts,
				depth: depthParam(opts.depth),
			}),

		images: async (file, ids, opts = {}) => {
			const nodeIds = requireNodeIds(ids, 'file images')
			requireValidScale(opts.scale)

			// One call for every id. Figma names batching as the primary way to stay
			// under the rate limit, and this is the tier that runs out first.
			const response = await gateway.renderImages(fileKeyFromInput(file), nodeIds, opts)
			const images: RenderedImage[] = nodeIds.map((nodeId) => {
				const url = response.images[nodeId] ?? null
				return { node_id: nodeId, url, rendered: url !== null }
			})
			const failed = images.filter((image) => !image.rendered)

			return {
				images,
				rendered_count: images.length - failed.length,
				failed_count: failed.length,
				failed_node_ids: failed.map((image) => image.node_id),
				url_expires_after_days: RENDER_URL_EXPIRY_DAYS,
			}
		},

		imageFills: async (file) => {
			const { images } = await gateway.getImageFills(fileKeyFromInput(file))
			const rows = Object.entries(images ?? {}).map(([image_ref, url]) => ({ image_ref, url }))

			return { images: rows, count: rows.length, url_expires_after_days: IMAGE_FILL_URL_EXPIRY_DAYS }
		},

		meta: async (file) => (await gateway.getMeta(fileKeyFromInput(file))).file,

		versions: (file, opts) => gateway.listVersions(fileKeyFromInput(file), opts),
	}
}
