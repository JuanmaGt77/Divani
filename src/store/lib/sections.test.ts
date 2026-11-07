import { describe, expect, it } from 'vitest';
import { hiddenCss } from './sections';

describe('hiddenCss', () => {
  it('sin secciones ocultas no genera nada', () => {
    expect(hiddenCss([])).toBe('');
    expect(hiddenCss(undefined)).toBe('');
  });

  it('oculta la sección', () => {
    expect(hiddenCss(['kids'])).toBe('[data-section="kids"]{display:none!important}');
  });

  it('también oculta los enlaces que llevan a la sección', () => {
    const css = hiddenCss(['about']);
    expect(css).toContain('[data-section="about"]{display:none!important}');
    expect(css).toContain('a[href$="#nosotros"]{display:none!important}');
    expect(css).toContain('li:has(> a[href$="#nosotros"]){display:none!important}');
  });

  it('deja cada regla por separado, por si el navegador no conoce :has()', () => {
    expect(hiddenCss(['faq']).match(/\{display:none!important\}/g)).toHaveLength(3);
  });

  it('ignora lo que no parece un nombre de sección', () => {
    expect(hiddenCss(['kids"]{}body{display:none'])).toBe('');
  });
});
