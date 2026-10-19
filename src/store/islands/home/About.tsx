/** Acerca de nosotros (Sitio web → Portada → Acerca de nosotros) y los cuatro pilares de Divani. */
import { cdn } from '@/lib/model';
import { Emph, Icon } from '../../components/Icon';
import { DEFAULT_CONTENT, useContent } from '../../data/content';

const PILLARS = [
  { icon: 'sparkle', title: 'Ropa americana', text: 'Prendas traídas de Estados Unidos, con la calidad que buscas.' },
  {
    icon: 'shield',
    title: 'Selección premium',
    text: 'Revisamos tela, acabados y calidad antes de publicar cada pieza.',
  },
  { icon: 'hanger', title: 'Piezas limitadas', text: 'Pocas piezas por modelo: un estilo que no se repite.' },
  { icon: 'chat', title: 'Atención personal', text: 'Te asesoramos por WhatsApp con tallas, medidas y combinaciones.' },
];

export default function About() {
  const content = useContent();
  const title = content.get('about', 'title');
  const image = content.get('about', 'image');
  const paragraphs = (content.get('about', 'paragraphs') || []).filter(Boolean);

  return (
    <section className="section about" id="nosotros" data-edit="about">
      <div className="container about__grid">
        <div className="about__intro">
          <p className="eyebrow">Acerca de nosotros</p>
          {title ? (
            <h2 className="h-2 about__title">
              <Emph text={title} />
            </h2>
          ) : null}
          <figure className="about__visual" data-reveal="scale" suppressHydrationWarning>
            {image ? (
              <img
                src={cdn(image, { w: 1400 })}
                alt={image === DEFAULT_CONTENT.about?.image ? 'Seda color marfil sobre fondo beige' : ''}
                loading="lazy"
                width={1280}
                height={720}
              />
            ) : null}
            <figcaption className="about__seal glass" data-monogram="" suppressHydrationWarning>
              <svg className="about__mark" viewBox="0 0 418 443" aria-hidden="true">
                <use href="#logo-mark" />
              </svg>
              <span>Fashion in you</span>
            </figcaption>
          </figure>
        </div>
        <div className="about__body">
          <div className="prose about__text">
            {paragraphs.map((p, i) => (
              <p key={i} className={i === 0 ? 'lead' : undefined}>
                {p}
              </p>
            ))}
          </div>
          <ul className="pillars list-reset">
            {PILLARS.map((p, i) => (
              <li
                key={p.title}
                className="pillar glass"
                data-reveal=""
                suppressHydrationWarning
                style={i ? { '--d': i } : undefined}
              >
                <Icon name={p.icon} />
                <h3 className="pillar__title">{p.title}</h3>
                <p>{p.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
