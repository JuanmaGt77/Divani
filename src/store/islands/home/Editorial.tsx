/** Franja editorial con foto a todo lo ancho (Sitio web → Portada → Editorial). */
import { cdn } from '@/lib/model';
import { Emph, Icon } from '../../components/Icon';
import { DEFAULT_CONTENT, useContent } from '../../data/content';

export default function Editorial() {
  const content = useContent();
  const image = content.get('editorial', 'image');
  const eyebrow = content.get('editorial', 'eyebrow');
  const title = content.get('editorial', 'title');
  // La descripción de la foto de fábrica no aplica a una foto nueva
  const alt = image === DEFAULT_CONTENT.editorial?.image ? 'Tela de seda color marfil en movimiento' : '';

  return (
    <section className="editorial" aria-label="Divani" data-edit="editorial">
      <div className="container">
        <div className="editorial__frame" data-reveal="scale">
          {image ? (
            <img
              className="editorial__img"
              src={cdn(image, { w: 1800 })}
              alt={alt}
              loading="lazy"
              width={1280}
              height={720}
            />
          ) : null}
          <div className="editorial__copy">
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            {title ? (
              <h2 className="editorial__title">
                <Emph text={title} />
              </h2>
            ) : null}
            <a className="btn btn--glass glass" href="#nosotros">
              Conoce nuestra historia
              <Icon name="arrow-right" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
