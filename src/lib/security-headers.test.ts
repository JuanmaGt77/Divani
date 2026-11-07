import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SECURITY_HEADERS } from './security-headers';

const estaticas = readFileSync('public/_headers', 'utf8');

describe('cabeceras de seguridad', () => {
  it.each(Object.entries(SECURITY_HEADERS))('%s es igual en el Worker y en public/_headers', (nombre, valor) => {
    expect(estaticas).toContain(`  ${nombre}: ${valor}\n`);
  });

  it('no permite eval ni que otros sitios muestren la página en un iframe', () => {
    const csp = SECURITY_HEADERS['Content-Security-Policy'];
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("object-src 'none'");
  });
});
