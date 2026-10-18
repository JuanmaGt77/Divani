/** Búsqueda instantánea: sugerencias, búsquedas recientes y resultados mientras escribes. */
import { useEffect, useMemo, useState } from 'react';
import type { PublicSettings, StorefrontPayload } from '@/lib/types';
import { Icon } from '../../components/Icon';
import { MiniCard } from '../../components/ProductCard';
import { Sheet } from '../../components/Sheet';
import { STORAGE_KEYS, load, save } from '../../lib/storage';
import { listProducts } from '../../data/storefront';

const shopUrl = (q: string) => `/tienda?q=${encodeURIComponent(q)}`;
const recent = (): string[] => load<string[]>(STORAGE_KEYS.recentSearches, []);
function remember(q: string) {
  const list = [q, ...recent().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 6);
  save(STORAGE_KEYS.recentSearches, list);
}

export function SearchSheet({
  open,
  onClose,
  settings,
  data,
  error,
}: {
  open: boolean;
  onClose: () => void;
  settings: PublicSettings;
  data: StorefrontPayload | null;
  error: boolean;
}) {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [recents, setRecents] = useState<string[]>([]);
  const popular = settings.popularSearches?.length
    ? settings.popularSearches
    : ['Vestidos', 'Mezclilla', 'Satín', 'Blazer'];

  useEffect(() => {
    if (open) setRecents(recent());
  }, [open]);
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 180);
    return () => clearTimeout(t);
  }, [text]);

  const featured = useMemo(
    () => (data ? listProducts(data, { isNew: true, pageSize: 4, sort: 'nuevo' }).data : []),
    [data],
  );
  const results = useMemo(
    () => (data && q ? listProducts(data, { q, pageSize: 8, sort: 'destacados' }) : null),
    [data, q],
  );

  const chips = (list: string[]) => (
    <div className="cluster" style={{ '--cluster': '8px' }}>
      {list.map((t) => (
        <a key={t} className="chip" href={shopUrl(t)} onClick={() => remember(t)}>
          {t}
        </a>
      ))}
    </div>
  );

  return (
    <Sheet id="search" open={open} onClose={onClose} variant="top" label="Buscar" initialFocus="#search-input">
      <form
        className="search"
        role="search"
        action="/tienda"
        onSubmit={(e) => {
          const v = text.trim();
          if (!v) {
            e.preventDefault();
            return;
          }
          remember(v);
        }}
      >
        <Icon name="search" className="search__icon" />
        <label className="visually-hidden" htmlFor="search-input">
          Buscar en la tienda
        </label>
        <input
          className="search__input"
          id="search-input"
          name="q"
          type="search"
          placeholder="Busca vestidos, mezclilla, blazer…"
          autoComplete="off"
          enterKeyHint="search"
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => {
            // Esc cierra la búsqueda a la primera (el campo nativo solo lo vaciaría)
            if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
          }}
        />
        <button className="icon-btn" type="button" onClick={onClose} aria-label="Cerrar búsqueda">
          <Icon name="close" />
        </button>
      </form>
      <div className="search__body">
        {!q ? (
          <>
            {recents.length > 0 && (
              <div className="search__group">
                <p className="search__label">Búsquedas recientes</p>
                {chips(recents)}
              </div>
            )}
            <div className="search__group">
              <p className="search__label">Lo más buscado</p>
              {chips(popular)}
            </div>
            {featured.length > 0 && (
              <div className="search__group">
                <p className="search__label">Recién llegado</p>
                <div className="search__results">
                  {featured.map((p) => (
                    <MiniCard key={p.slug} product={p} />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : !results ? (
          <p className="search__empty">
            {error ? 'No pudimos buscar en este momento. Revisa tu conexión e inténtalo de nuevo.' : 'Buscando…'}
          </p>
        ) : results.data.length ? (
          <>
            <div className="search__group">
              <p className="search__label">
                {results.meta.total} {results.meta.total === 1 ? 'resultado' : 'resultados'}
              </p>
              <div className="search__results">
                {results.data.map((p) => (
                  <MiniCard key={p.slug} product={p} onOpen={() => remember(q)} />
                ))}
              </div>
            </div>
            {results.meta.total > results.data.length && (
              <a className="btn btn--outline search__all" href={shopUrl(q)} onClick={() => remember(q)}>
                Ver los {results.meta.total} resultados
              </a>
            )}
          </>
        ) : (
          <div className="search__group">
            <p className="search__empty">No encontramos prendas para «{q}». Prueba con otra palabra, por ejemplo:</p>
            {chips(popular)}
          </div>
        )}
      </div>
    </Sheet>
  );
}
