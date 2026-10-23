import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
export default defineConfig({
  site: 'https://neplirio.github.io',
  base: '/astro-material-blog',
  trailingSlash: 'always',
  integrations: [sitemap({ filter: (page) => !page.endsWith('/404/') })],
  markdown: { shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' }, wrap: true } },
});
