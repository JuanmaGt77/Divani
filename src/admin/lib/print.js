/**
 * Impresión: tickets (58/80 mm), cortes de caja, reportes (A4) y etiquetas.
 * Se arma un documento aparte con su propio estilo y se manda a imprimir
 * (desde ahí también se puede «Guardar como PDF»).
 */
export const escHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const BASE = `
  *{box-sizing:border-box;margin:0;padding:0}
  html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:"Jost",-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#171513;font-size:12px;line-height:1.4}
  h1,h2,h3{font-weight:500}
  .serif{font-family:"Bodoni Moda","Didot","Times New Roman",serif}
  table{width:100%;border-collapse:collapse}
  th,td{text-align:left;padding:5px 6px;vertical-align:top}
  th{font-weight:500;color:#6b5f53;font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;border-bottom:1px solid #d9d0c3}
  td{border-bottom:1px solid #eee7dc}
  .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  .muted{color:#6b5f53}
  .center{text-align:center}
  .logo{display:block;height:34px;margin:0 auto 6px}
`;

const PAGES = {
  A4: '@page{size:A4;margin:14mm 12mm}',
  'A4-landscape': '@page{size:A4 landscape;margin:12mm}',
  ticket80: '@page{size:80mm auto;margin:3mm}body{width:74mm;font-size:11.5px}',
  ticket58: '@page{size:58mm auto;margin:2mm}body{width:54mm;font-size:10.5px}',
  labels: '@page{size:A4;margin:8mm}',
};

const FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400..600&family=Jost:wght@300..600&display=swap">';

const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function printDocument({ title = 'Divani', body, css = '', page = 'A4' }) {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(title)}</title>${FONTS}<base href="${escHtml(document.baseURI)}"><style>${BASE}${page === 'custom' ? '' : PAGES[page] || PAGES.A4}${css}</style></head><body>${body}</body></html>`;

  // En iPhone/iPad la impresión desde un iframe oculto no es confiable: se abre en una pestaña
  if (isIOS()) {
    const w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(html.replace('</body>', '<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body>'));
      w.document.close();
      return;
    }
  }

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
  document.body.append(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(html);
  doc.close();
  const waits = [
    ...Array.from(doc.images).map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; }))),
    doc.fonts?.ready?.catch(() => null),
  ].filter(Boolean);
  Promise.race([Promise.all(waits), new Promise((r) => setTimeout(r, 1500))]).then(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 60_000);
  });
}
