// @ts-check
/**
 * Configuración de Astro.
 *  - Las páginas de la tienda se generan como HTML estático (rápidas y fáciles de cachear).
 *  - /producto/[slug] y /admin se generan en el servidor (Cloudflare Workers): la primera para
 *    que cada prenda tenga su propia vista previa al compartirla; la segunda para que cualquier
 *    dirección del panel abra la aplicación.
 *  - Las variables públicas de Supabase se validan al compilar: si faltan, la compilación falla
 *    en lugar de publicar una tienda que no carga.
 */
import { defineConfig, envField } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import { loadEnv } from 'vite';

// Astro no lee los archivos .env dentro de la configuración: se cargan aquí solo para `site`
const { PUBLIC_SITE_URL } = { ...loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), ''), ...process.env };

// Cloudflare copia por defecto TODO .env/.env.local al servidor local (dist/server/.dev.vars),
// incluidas llaves privadas que solo usa `npm run setup:supabase`. El servidor no las necesita:
// las variables PUBLIC_* las incorpora Astro al compilar.
process.env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV ??= 'false';

export default defineConfig({
  // Dirección pública de la tienda (https://…). Se usa en las vistas previas al compartir.
  site: PUBLIC_SITE_URL || undefined,
  output: 'static',
  adapter: cloudflare({ imageService: 'passthrough' }),
  integrations: [react()],
  session: false,
  trailingSlash: 'never',
  build: { format: 'file' },
  compressHTML: true,
  devToolbar: { enabled: false },
  server: { port: 5173 },
  env: {
    schema: {
      PUBLIC_SUPABASE_URL: envField.string({ context: 'client', access: 'public', url: true }),
      PUBLIC_SUPABASE_PUBLISHABLE_KEY: envField.string({ context: 'client', access: 'public' }),
    },
  },
});
