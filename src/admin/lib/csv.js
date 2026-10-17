/** Exportar a CSV (se abre directo en Excel, Numbers o Google Sheets, con acentos). */

const esc = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** columns: [{ label, key }] o [{ label, value: (row) => … }] */
export function toCsv(rows, columns) {
  const head = columns.map((c) => esc(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => esc(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(','));
  return `﻿${[head, ...body].join('\r\n')}`;
}

export function download(filename, content, type = 'text/csv;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const exportCsv = (filename, rows, columns) => download(filename.endsWith('.csv') ? filename : `${filename}.csv`, toCsv(rows, columns));

export const fileStamp = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
