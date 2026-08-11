import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'

export default defineConfig({
	site: 'https://cyberuni.github.io',
	base: '/cyber-figma',
	integrations: [
		starlight({
			title: 'cyber-figma',
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/cyberuni/cyber-figma',
				},
			],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', link: '/' },
						{ label: 'Installation', link: '/installation/' },
						{ label: 'Authentication', link: '/authentication/' },
					],
				},
				{
					label: 'CLI',
					items: [{ autogenerate: { directory: 'cli' } }],
				},
				{
					label: 'MCP',
					items: [{ autogenerate: { directory: 'mcp' } }],
				},
				{
					label: 'Skills',
					items: [{ autogenerate: { directory: 'skills' } }],
				},
				{
					label: 'Reference',
					items: [{ autogenerate: { directory: 'reference' } }],
				},
			],
			editLink: {
				baseUrl: 'https://github.com/cyberuni/cyber-figma/edit/main/apps/web/',
			},
		}),
	],
})
