import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

/**
 * Inserta fragmentos HTML compartidos (header, footer, overlays…) en cada página.
 * Uso en el HTML:  <!-- @include partials/header.html -->
 * Los fragmentos viven en src/partials/ y pueden incluir otros fragmentos.
 */
function htmlPartials() {
  const dir = resolve(root, 'src');
  const pattern = /<!--\s*@include\s+([\w./-]+)\s*-->/g;
  const inline = (html, depth = 0) => {
    if (depth > 5) return html;
    return html.replace(pattern, (_, file) => inline(readFileSync(resolve(dir, file), 'utf8'), depth + 1));
  };
  return {
    name: 'divani-html-partials',
    transformIndexHtml: { order: 'pre', handler: (html) => inline(html) },
    handleHotUpdate({ file, server }) {
      if (file.includes('/src/partials/')) server.ws.send({ type: 'full-reload' });
    },
  };
}

export default defineConfig({
  // Rutas relativas: el sitio funciona en la raíz de un dominio o dentro de una subcarpeta.
  base: './',
  plugins: [htmlPartials()],
  // El panel (src/admin) usa Preact con JSX
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  server: { port: 5173, open: true },
  build: {
    outDir: 'dist',
    assetsDir: 'static',
    rollupOptions: {
      input: {
        inicio: resolve(root, 'index.html'),
        tienda: resolve(root, 'tienda.html'),
        noEncontrado: resolve(root, '404.html'),
        privacidad: resolve(root, 'aviso-de-privacidad.html'),
        admin: resolve(root, 'admin.html'),
      },
    },
  },
});
