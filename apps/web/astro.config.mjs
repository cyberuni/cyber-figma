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
			// Sections are added by the docs pod as content lands under src/content/docs.
			sidebar: [
				{
					label: 'Getting Started',
					items: [{ label: 'Introduction', link: '/' }],
				},
			],
			editLink: {
				baseUrl: 'https://github.com/cyberuni/cyber-figma/edit/main/apps/web/',
			},
		}),
	],
})
