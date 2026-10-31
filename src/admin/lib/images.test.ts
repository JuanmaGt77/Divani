import { describe, expect, it } from 'vitest';
import { fileSize, savingsText } from './images';

describe('peso de las fotos', () => {
  it('muestra KB o MB', () => {
    expect(fileSize(112_000)).toBe('109 KB');
    expect(fileSize(2_870_000)).toMatch(/^2[.,]7 MB$/);
    expect(fileSize(10)).toBe('1 KB');
  });

  it('resume lo que se ahorró al subir', () => {
    expect(savingsText({ before: 2_870_000, after: 112_000, format: 'webp' })).toMatch(
      /^2[.,]7 MB → 109 KB en WebP \(96 % menos\)$/,
    );
    expect(savingsText({ before: 40_000, after: 52_000, format: 'webp' })).toBe('Guardada en WebP (51 KB)');
    expect(savingsText({ before: 500_000, after: 100_000, format: '' })).toBe('488 KB → 98 KB (80 % menos)');
  });
});
