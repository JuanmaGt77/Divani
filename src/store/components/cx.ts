/** Une clases de CSS ignorando las vacías: cx('card', soldOut && 'is-soldout') */
export const cx = (...a: unknown[]): string => a.filter(Boolean).join(' ');
