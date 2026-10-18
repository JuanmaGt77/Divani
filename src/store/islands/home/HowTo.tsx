/** Cómo comprar: los cuatro pasos y un ejemplo de pedido por WhatsApp en un teléfono. */
import type { RegionSettings } from '@/lib/types';
import { Icon } from '../../components/Icon';
import { useSettings } from '../../data/storefront';
import { greetingMessage, waLink } from '../../lib/whatsapp';

const STEPS = [
  { title: 'Elige tus favoritas', text: 'Explora la tienda, elige color y talla y agrégalas a tu bolsa.' },
  { title: 'Envía tu pedido por WhatsApp', text: 'Con un toque se arma un mensaje con tus prendas, tallas y total.' },
  { title: 'Confirma pago y envío', text: 'Te confirmamos disponibilidad, costo de envío y datos de pago.' },
  { title: 'Recíbelo en casa', text: 'Preparamos tu pedido con cuidado y te avisamos cuando va en camino.' },
];

/** Precios del ejemplo en la moneda de la tienda (con los ajustes de la isla, no con los globales). */
const price = (n: number, region: RegionSettings) =>
  new Intl.NumberFormat(region.locale, {
    style: 'currency',
    currency: region.currency,
    maximumFractionDigits: 0,
  }).format(n);

export default function HowTo() {
  const settings = useSettings();
  const { region } = settings;
  const city = region.cityPlaceholder.replace(/^ej\.?\s*/i, '') || 'tu ciudad';

  return (
    <section className="section section--linen howto" id="como-comprar">
      <div className="container howto__grid">
        <div className="howto__text">
          <header className="section-head__text">
            <p className="eyebrow">Compra por WhatsApp</p>
            <h2 className="h-2">
              Comprar es <em>así de fácil</em>
            </h2>
          </header>
          <ol className="steps list-reset">
            {STEPS.map((s, i) => (
              <li key={s.title} className="step" data-reveal="" style={i ? { '--d': i } : undefined}>
                <span className="step__n">{i + 1}</span>
                <div>
                  <h3 className="step__title">{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <a
            className="btn btn--ink btn--wa"
            href={waLink(settings, greetingMessage(settings))}
            target="_blank"
            rel="noopener"
          >
            <Icon name="whatsapp" />
            Empezar por WhatsApp
          </a>
        </div>

        <figure className="phone" aria-label="Ejemplo de un pedido enviado por WhatsApp" data-phone="">
          <div className="phone__frame">
            <div className="phone__island" aria-hidden="true" />
            <div className="phone__screen">
              <div className="phone__bar glass">
                <span className="phone__avatar">
                  <svg viewBox="0 0 418 443" aria-hidden="true">
                    <use href="#logo-mark" />
                  </svg>
                </span>
                <span className="phone__who">
                  <strong>{settings.store?.name || 'Divani'}</strong>
                  <small>en línea</small>
                </span>
              </div>
              <div className="chat">
                <p className="chat__day">Hoy</p>
                <div className="bubble bubble--out" style={{ '--d': 0 }}>
                  <p>Hola Divani, quiero hacer este pedido:</p>
                  <p>
                    <strong>Pedido DV-1016-K7Q2</strong>
                  </p>
                  <p>
                    1. Vestido slip satinado
                    <br />
                    <span>Champagne · Talla M · {price(349, region)}</span>
                  </p>
                  <p>
                    2. Jeans wide leg tiro alto
                    <br />
                    <span>Azul claro · Talla 6 · {price(299, region)}</span>
                  </p>
                  <p>
                    <strong>
                      Total: {price(648, region)} {region.currency}
                    </strong>
                  </p>
                  <time>12:41</time>
                </div>
                <div className="bubble bubble--in" style={{ '--d': 1 }}>
                  <p>
                    ¡Hola! Gracias por tu pedido. Las dos prendas están disponibles; te compartimos el costo de envío y
                    los datos de pago.
                  </p>
                  <time>12:43</time>
                </div>
                <div className="bubble bubble--out" style={{ '--d': 2 }}>
                  <p>¡Perfecto! Envío a {city}, por favor.</p>
                  <time>12:44</time>
                </div>
              </div>
            </div>
          </div>
          <figcaption className="visually-hidden">Ejemplo ilustrativo de una conversación de compra.</figcaption>
        </figure>
      </div>
    </section>
  );
}
