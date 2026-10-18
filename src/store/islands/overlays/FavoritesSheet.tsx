/** Hoja de favoritos: prendas guardadas, con opción de preguntar por ellas por WhatsApp. */
import { plural } from '@/lib/format';
import type { PublicSettings, StorefrontPayload } from '@/lib/types';
import { Icon } from '../../components/Icon';
import { MiniCard } from '../../components/ProductCard';
import { Sheet } from '../../components/Sheet';
import { productsBySlug } from '../../data/storefront';
import { favoritesMessage, waLink } from '../../lib/whatsapp';
import { favorites, useFavorites } from '../../state/favorites';

export function FavoritesSheet({
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
  const slugs = useFavorites();
  const items = data ? productsBySlug(data, slugs) : [];
  return (
    <Sheet id="favorites" open={open} onClose={onClose} variant="side" labelledBy="fav-title" grabber>
      <header className="sheet__head">
        <h2 className="sheet__title" id="fav-title">
          Favoritos{slugs.length ? <small>{plural(slugs.length, 'prenda', 'prendas')}</small> : null}
        </h2>
        <button className="icon-btn glass round" type="button" onClick={onClose} aria-label="Cerrar favoritos">
          <Icon name="close" />
        </button>
      </header>
      <div className="favs">
        {!slugs.length ? (
          <div className="empty">
            <span className="empty__icon glass">
              <Icon name="heart" />
            </span>
            <h3>Aún no tienes favoritos</h3>
            <p>Toca el corazón en cualquier prenda para guardarla aquí y encontrarla después.</p>
            <a className="btn btn--ink" href="/tienda">
              Descubrir prendas
            </a>
          </div>
        ) : !data ? (
          <div className="empty">
            <p>
              {error
                ? 'No pudimos cargar tus favoritos. Revisa tu conexión e inténtalo de nuevo.'
                : 'Cargando tus favoritos…'}
            </p>
          </div>
        ) : (
          <>
            <div className="favs__grid">
              {items.map((p) => (
                <div key={p.slug} className="favs__item">
                  <MiniCard product={p} />
                  <button
                    className="icon-btn glass round"
                    type="button"
                    aria-pressed="true"
                    aria-label={`Quitar ${p.name} de favoritos`}
                    onClick={() => favorites.remove(p.slug)}
                  >
                    <Icon name="close" />
                  </button>
                </div>
              ))}
            </div>
            <footer className="favs__foot">
              <a
                className="btn btn--ink btn--wa btn--block"
                href={waLink(settings, favoritesMessage(settings, items))}
                target="_blank"
                rel="noopener"
              >
                <Icon name="whatsapp" />
                Preguntar por mis favoritos
              </a>
            </footer>
          </>
        )}
      </div>
    </Sheet>
  );
}
