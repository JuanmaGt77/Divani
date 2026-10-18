/** Pie de página: frase de marca, enlaces, contacto y redes (lo que se configura en el panel). */
import { Icon } from '../components/Icon';
import { SocialLinks } from '../components/Social';
import { useStorefront, useSettings } from '../data/storefront';
import { useHydrated } from '../lib/hydration';
import { visibleDepartments, whatsappDisplay } from '../lib/site';
import { greetingMessage, waLink } from '../lib/whatsapp';
import { openSizeGuide } from '../state/ui';

export default function SiteFooter({ year }: { year: number }) {
  const { data } = useStorefront();
  const settings = useSettings();
  const store = settings.store;
  const wa = waLink(settings, greetingMessage(settings));
  const deps = visibleDepartments(data);
  // El año de la compilación hasta que carga la página; después, el actual
  const shownYear = useHydrated() ? new Date().getFullYear() : year;

  return (
    <footer className="site-footer" id="contacto" data-edit="store">
      <div className="container">
        <div className="site-footer__top">
          <div className="site-footer__brand">
            <p className="site-footer__claim display">
              Ropa americana <em>premium.</em>
            </p>
            <a className="btn btn--light btn--wa" href={wa} target="_blank" rel="noopener">
              <Icon name="whatsapp" />
              Escríbenos por WhatsApp
            </a>
          </div>

          <nav className="site-footer__cols" aria-label="Pie de página">
            <div className="site-footer__col">
              <h3 className="site-footer__h">Tienda</h3>
              <ul className="list-reset">
                {deps.map((d) => (
                  <li key={d.slug}>
                    <a href={`/tienda?depto=${d.slug}`}>{d.label}</a>
                  </li>
                ))}
                <li>
                  <a href="/tienda?orden=nuevo">Novedades</a>
                </li>
                <li>
                  <a href="/tienda?oferta=1">Ofertas</a>
                </li>
              </ul>
            </div>
            <div className="site-footer__col">
              <h3 className="site-footer__h">Ayuda</h3>
              <ul className="list-reset">
                <li>
                  <a href="/#como-comprar">Cómo comprar</a>
                </li>
                <li>
                  <button type="button" onClick={() => openSizeGuide()}>
                    Guía de tallas
                  </button>
                </li>
                <li>
                  <a href="/#preguntas">Envíos y pagos</a>
                </li>
                <li>
                  <a href="/#preguntas">Preguntas frecuentes</a>
                </li>
                <li>
                  <a href="/#nosotros">Acerca de nosotros</a>
                </li>
              </ul>
            </div>
            <div className="site-footer__col">
              <h3 className="site-footer__h">Contacto</h3>
              <ul className="list-reset site-footer__contact">
                <li>
                  <Icon name="whatsapp" />
                  <a href={wa} target="_blank" rel="noopener">
                    {whatsappDisplay(settings.whatsapp)}
                  </a>
                </li>
                <li>
                  <Icon name="clock" />
                  <span>{store.hours}</span>
                </li>
                <li>
                  <Icon name="truck" />
                  <span>Envíos a {settings.region.shippingArea}</span>
                </li>
                {store.address && (
                  <li>
                    <Icon name="map-pin" />
                    <span>{store.address}</span>
                  </li>
                )}
                {store.email && (
                  <li>
                    <Icon name="chat" />
                    <a href={`mailto:${store.email}`}>{store.email}</a>
                  </li>
                )}
              </ul>
              <div className="site-footer__social">
                <SocialLinks settings={settings} />
              </div>
            </div>
          </nav>
        </div>

        <div className="site-footer__word" aria-hidden="true">
          <svg viewBox="0 0 805 247">
            <use href="#logo-wordmark" />
          </svg>
        </div>

        <div className="site-footer__bottom">
          <p>
            © {shownYear} {store.name} · Fashion in you
          </p>
          <p className="site-footer__legal">
            <a href="/aviso-de-privacidad">Aviso de privacidad</a>
            <span aria-hidden="true">·</span>
            <span>
              Precios en {settings.region.currencyName} ({settings.region.currency})
            </span>
            <span aria-hidden="true">·</span>
            <a href="/admin">Administración</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
