import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';

const celda = (valor: unknown): string => toCsv([{ a: valor }], [{ label: 'A', key: 'a' }]).split('\r\n')[1] as string;

describe('toCsv', () => {
  it.each([
    ['=HYPERLINK("http://malo")', `"'=HYPERLINK(""http://malo"")"`],
    ['+cmd|calc', `'+cmd|calc`],
    ['-2+3', `'-2+3`],
    ['@SUM(A1)', `'@SUM(A1)`],
  ])('neutraliza la fórmula %s', (entrada, salida) => {
    expect(celda(entrada)).toBe(salida);
  });

  it('no toca números ni textos normales', () => {
    expect(celda(-5)).toBe('-5');
    expect(celda('-12.50')).toBe('-12.50');
    expect(celda('+50231916113')).toBe('+50231916113');
    expect(celda('María López')).toBe('María López');
    expect(celda(null)).toBe('');
  });

  it('sigue escapando comas y comillas', () => {
    expect(celda('Calle 5, zona 1')).toBe('"Calle 5, zona 1"');
    expect(celda('dijo "hola"')).toBe('"dijo ""hola"""');
  });
});
