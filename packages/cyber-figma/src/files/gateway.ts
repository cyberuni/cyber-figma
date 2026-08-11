import { type FigmaClient, floatParam } from '../client.js'
import type {
	GetFileMetaResponse,
	GetFileNodesResponse,
	GetFileResponse,
	GetImageFillsResponse,
	GetImagesResponse,
	Version,
} from '../figma-types.js'
import {
	collectPages,
	type PaginatedResult,
	type PaginationOptions,
	type PaginationSpec,
	paginationParamsFor,
} from '../pagination.js'

// The six Files endpoints. Three of them (get, nodes, render) are Figma's most
// expensive rate-limit tier — a View or Collab seat gets roughly six calls a
// month on every plan — so the cost-shaping defaults live one layer up in
// api.ts, and this layer stays a faithful description of the wire.

/** GET file versions: `page_size` with `before`/`after`, answered as full page URLs. */
export const FILE_VERSION_PAGINATION: PaginationSpec = {
	model: 'url_page',
	itemsKey: 'versions',
	defaultPageSize: 30,
}

export type FileTreeOptions = {
	/** A specific version id; the current version when omitted. */
	version?: string
	/** Node ids to narrow the document to — the cheapest way to shrink a tier-1 response. */
	ids?: string[]
	/** How deep to traverse: 1 = pages, 2 = pages plus their top-level objects. Omit for the whole tree. */
	depth?: number
	/** `paths` exports vector geometry. */
	geometry?: 'paths'
	/** Comma-separated plugin ids and/or the string `shared`. */
	pluginData?: string
	/** Returns branch metadata — the only way to obtain a branch key. */
	branchData?: boolean
}

/** GET file nodes takes the same tree parameters, minus `branch_data`. */
export type NodeTreeOptions = Omit<FileTreeOptions, 'ids' | 'branchData'>

export type RenderOptions = {
	version?: string
	/** 0.01–4. The one Figma query parameter that is legitimately fractional. */
	scale?: number
	format?: 'jpg' | 'png' | 'svg' | 'pdf'
	svgOutlineText?: boolean
	svgIncludeId?: boolean
	svgIncludeNodeId?: boolean
	svgSimplifyStroke?: boolean
	contentsOnly?: boolean
	useAbsoluteBounds?: boolean
}

export type FileGateway = {
	get: (fileKey: string, opts?: FileTreeOptions) => Promise<GetFileResponse>
	getNodes: (fileKey: string, ids: string[], opts?: NodeTreeOptions) => Promise<GetFileNodesResponse>
	renderImages: (fileKey: string, ids: string[], opts?: RenderOptions) => Promise<GetImagesResponse>
	getImageFills: (fileKey: string) => Promise<GetImageFillsResponse['meta']>
	getMeta: (fileKey: string) => Promise<GetFileMetaResponse>
	listVersions: (fileKey: string, opts?: PaginationOptions) => Promise<PaginatedResult<Version>>
}

function treeQuery(opts: FileTreeOptions = {}) {
	return {
		version: opts.version,
		ids: opts.ids,
		depth: opts.depth,
		geometry: opts.geometry,
		plugin_data: opts.pluginData,
		branch_data: opts.branchData,
	}
}

export function createFigmaFileGateway(client: FigmaClient): FileGateway {
	return {
		get: (fileKey, opts) =>
			client.request({
				method: 'GET',
				path: `/v1/files/${encodeURIComponent(fileKey)}`,
				query: treeQuery(opts),
			}),

		getNodes: (fileKey, ids, opts) =>
			client.request({
				method: 'GET',
				path: `/v1/files/${encodeURIComponent(fileKey)}/nodes`,
				query: { ...treeQuery(opts), ids },
			}),

		renderImages: (fileKey, ids, opts = {}) =>
			client.request({
				// Note the shape: this is /v1/images/{key}, not a sub-path of the file.
				method: 'GET',
				path: `/v1/images/${encodeURIComponent(fileKey)}`,
				query: {
					ids,
					version: opts.version,
					// Truncating this one to an integer would silently turn --scale 1.5 into 1.
					scale: opts.scale === undefined ? undefined : floatParam(opts.scale),
					format: opts.format,
					svg_outline_text: opts.svgOutlineText,
					svg_include_id: opts.svgIncludeId,
					svg_include_node_id: opts.svgIncludeNodeId,
					svg_simplify_stroke: opts.svgSimplifyStroke,
					contents_only: opts.contentsOnly,
					use_absolute_bounds: opts.useAbsoluteBounds,
				},
			}),

		getImageFills: (fileKey) =>
			client.request({
				method: 'GET',
				path: `/v1/files/${encodeURIComponent(fileKey)}/images`,
				unwrap: 'meta',
			}),

		getMeta: (fileKey) => client.request({ method: 'GET', path: `/v1/files/${encodeURIComponent(fileKey)}/meta` }),

		listVersions: (fileKey, opts) =>
			collectPages<Version>(
				FILE_VERSION_PAGINATION,
				(page) =>
					client.request({
						method: 'GET',
						path: `/v1/files/${encodeURIComponent(fileKey)}/versions`,
						query: paginationParamsFor(FILE_VERSION_PAGINATION, { ...page, applyDefaults: true }),
					}),
				opts,
			),
	}
}
