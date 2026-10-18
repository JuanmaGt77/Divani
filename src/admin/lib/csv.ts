/** Exportar a CSV (se abre directo en Excel, Numbers o Google Sheets, con acentos). */

const esc = (v: unknown): string => {
  const s = v == null ? '' : String(v);
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export type CsvColumn<T> = { label: string; key: keyof T & string } | { label: string; value: (row: T) => unknown };

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => esc(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => esc('value' in c ? c.value(r) : r[c.key])).join(','));
  return `\uFEFF${[head, ...body].join('\r\n')}`;
}

export function download(filename: string, content: string | Blob, type = 'text/csv;charset=utf-8'): void {
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

export const exportCsv = <T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void =>
  download(filename.endsWith('.csv') ? filename : `${filename}.csv`, toCsv(rows, columns));

export const fileStamp = (d = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
