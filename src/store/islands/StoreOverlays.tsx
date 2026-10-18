/**
 * Isla con todo lo que flota sobre la página: hojas (menú, búsqueda, bolsa, favoritos, vista
 * rápida y guía de tallas), el aviso tipo Dynamic Island, la barra inferior del celular y el
 * botón de WhatsApp. Las demás islas abren las hojas a través del estado compartido (state/ui).
 */
import { useCallback, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { DEFAULT_SETTINGS } from '@/lib/model';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { SizeGuide } from '../components/SizeGuide';
import { useStorefront } from '../data/storefront';
import { getParams } from '../lib/url';
import { $sheet, $sizeGuide, closeSheet, openProduct } from '../state/ui';
import { CartSheet } from './overlays/CartSheet';
import { FavoritesSheet } from './overlays/FavoritesSheet';
import { Island } from './overlays/Island';
import { MenuSheet } from './overlays/MenuSheet';
import { ProductSheet } from './overlays/ProductSheet';
import { SearchSheet } from './overlays/SearchSheet';
import { Tabbar, WaFab, type Tab } from './overlays/Tabbar';

export default function StoreOverlays({ tab }: { tab?: Tab }) {
  const { data, status, hydrated } = useStorefront();
  const settings = data?.settings || DEFAULT_SETTINGS.public;
  const sheet = useStore($sheet);
  const sizeDept = useStore($sizeGuide);
  const close = useCallback(() => closeSheet(), []);

  // Enlaces compartidos con ?p=slug abren la vista rápida de esa prenda
  useEffect(() => {
    if (!hydrated) return undefined;
    const slug = getParams().get('p');
    if (!slug) return undefined;
    const t = setTimeout(() => openProduct(slug), 350);
    return () => clearTimeout(t);
  }, [hydrated]);

  return (
    <>
      <MenuSheet open={sheet === 'menu'} onClose={close} settings={settings} data={data} />
      <SearchSheet
        open={sheet === 'search'}
        onClose={close}
        settings={settings}
        data={data}
        error={status === 'error'}
      />
      <CartSheet open={sheet === 'cart'} onClose={close} settings={settings} />
      <FavoritesSheet
        open={sheet === 'favorites'}
        onClose={close}
        settings={settings}
        data={data}
        error={status === 'error'}
      />
      <ProductSheet open={sheet === 'product'} onClose={close} settings={settings} data={data} status={status} />
      <Sheet
        id="sizes"
        open={sheet === 'sizes'}
        onClose={close}
        variant="center"
        className="sheet--sizes"
        labelledBy="sizes-title"
        grabber
      >
        <header className="sheet__head">
          <h2 className="sheet__title" id="sizes-title">
            Guía de tallas
          </h2>
          <button className="icon-btn glass round" type="button" onClick={close} aria-label="Cerrar guía de tallas">
            <Icon name="close" />
          </button>
        </header>
        <div className="sizes">
          <SizeGuide dept={sizeDept} onDept={(d) => $sizeGuide.set(d)} />
        </div>
      </Sheet>
      <Island />
      <Tabbar active={tab} settings={settings} />
      <WaFab settings={settings} />
    </>
  );
}
