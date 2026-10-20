/** Vista rápida de producto (hoja). La URL lleva ?p=slug para que el enlace se pueda compartir. */
import { useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import type { PublicSettings, StorefrontPayload } from '@/lib/types';
import { Icon } from '../../components/Icon';
import { ProductDetail } from '../../components/ProductDetail';
import { Sheet } from '../../components/Sheet';
import { categoryName, findProduct } from '../../data/storefront';
import { trackProduct } from '../../lib/analytics';
import { setParams } from '../../lib/url';
import { $quickView, notify } from '../../state/ui';

export function ProductSheet({
  open,
  onClose,
  settings,
  data,
  status,
}: {
  open: boolean;
  onClose: () => void;
  settings: PublicSettings;
  data: StorefrontPayload | null;
  status: string;
}) {
  const target = useStore($quickView);
  const product = target ? findProduct(data, target.slug) : null;

  // La prenda ya no existe (o se agotó y se ocultó): se avisa en lugar de abrir una hoja vacía
  useEffect(() => {
    if (!open || !target || !data || product) return;
    notify({ title: 'No encontramos esa prenda', sub: 'Puede que ya se haya agotado.', icon: 'info' });
    onClose();
  }, [open, target, data, product, onClose]);

  // ?p=slug mientras está abierta; al cerrarla se quita (solo si la abrió esta hoja)
  const shownSlug = useRef<string | null>(null);
  useEffect(() => {
    if (open && product) {
      // Cada prenda abierta cuenta para «prendas más vistas» (Panel → Visitas)
      if (shownSlug.current !== product.slug) trackProduct(product.slug);
      setParams({ p: product.slug });
      shownSlug.current = product.slug;
    } else if (!open && shownSlug.current) {
      setParams({ p: null });
      shownSlug.current = null;
    }
  }, [open, product]);

  return (
    <Sheet
      id="product"
      open={open && (!!product || status !== 'ready')}
      onClose={onClose}
      variant="center"
      className="sheet--product"
      label="Detalle del producto"
      grabber
    >
      <button className="icon-btn glass round sheet__close-float" type="button" onClick={onClose} aria-label="Cerrar">
        <Icon name="close" />
      </button>
      <div className="pdp">
        {product && target ? (
          <ProductDetail
            key={`${product.slug}-${target.seq}`}
            product={product}
            initialColor={target.color}
            categoryName={categoryName(data, product.category)}
            settings={settings}
            onAdded={onClose}
          />
        ) : (
          <div className="pdp__gallery skeleton" aria-busy="true" />
        )}
      </div>
    </Sheet>
  );
}
