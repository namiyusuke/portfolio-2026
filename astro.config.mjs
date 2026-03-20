// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'url';
import glsl from 'vite-plugin-glsl';

// https://astro.build/config
export default defineConfig({
  server: {
    host: true,
  },
  vite: {
    plugins: [glsl()],
    resolve: {
      alias: {
        Util: fileURLToPath(new URL('./src/assets/js/_utils', import.meta.url)),
      },
    },
  },
});
