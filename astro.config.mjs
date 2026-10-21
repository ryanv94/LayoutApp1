import { defineConfig } from 'astro/config';
export default defineConfig({
  output: 'static',
  site: 'https://ryanv94.github.io',
  base: '/LayoutApp1',
  server: { port: 4321 },
});
