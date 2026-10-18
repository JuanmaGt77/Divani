/** Lista VIP: invita a unirse a la lista de difusión de WhatsApp (Sitio web → Portada → Lista VIP). */
import { cdn } from '@/lib/model';
import { Emph, Icon } from '../../components/Icon';
import { useContent } from '../../data/content';
import { useSettings } from '../../data/storefront';
import { vipMessage, waLink } from '../../lib/whatsapp';

export default function Vip() {
  const content = useContent();
  const settings = useSettings();
  const title = content.get('vip', 'title');
  const text = content.get('vip', 'text');
  const image = content.get('vip', 'image');

  return (
    <section className="vip" data-edit="vip">
      <div className="container">
        <div className="vip__card" data-reveal="scale">
          {image ? (
            <img className="vip__bg" src={cdn(image, { w: 1800 })} alt="" loading="lazy" width={1280} height={720} />
          ) : null}
          <div className="vip__content glass">
            <p className="eyebrow">Lista VIP</p>
            {title ? (
              <h2 className="h-2">
                <Emph text={title} />
              </h2>
            ) : null}
            {text ? <p>{text}</p> : null}
            <a
              className="btn btn--ink btn--wa"
              href={waLink(settings, vipMessage(settings))}
              target="_blank"
              rel="noopener"
            >
              <Icon name="whatsapp" />
              Unirme a la lista VIP
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
