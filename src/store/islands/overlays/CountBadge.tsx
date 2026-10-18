/** Contador de la bolsa y favoritos: rebota cuando sube. */
import { useEffect, useRef, useState } from 'react';
import { cx } from '../../components/cx';

export function CountBadge({ count }: { count: number }) {
  const prev = useRef(count);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    if (count > prev.current) setBump((b) => b + 1);
    prev.current = count;
  }, [count]);
  // La llave cambia con cada aumento: así la animación se reinicia
  return (
    <span key={bump} className={cx('count-badge', bump > 0 && 'is-bump')} data-count={count}>
      {count > 9 ? '9+' : count ? String(count) : ''}
    </span>
  );
}
