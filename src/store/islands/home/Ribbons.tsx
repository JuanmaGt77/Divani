/** Cintas cruzadas: una de tinta y una de vidrio que corren en sentidos opuestos. */
import { Emph } from '../../components/Icon';
import { Marquee } from '../../components/Marquee';
import { useContent } from '../../data/content';

export default function Ribbons() {
  const content = useContent();
  const primary = content.get('ribbons', 'primary') || [];
  const secondary = content.get('ribbons', 'secondary') || [];
  return (
    <section className="ribbons" aria-label="Divani en pocas palabras" data-edit="ribbons">
      <div className="ribbon ribbon--ink">
        <Marquee
          className="ribbon__track"
          items={primary.map((t, i) => (
            <Emph key={i} text={t} />
          ))}
        />
      </div>
      <div className="ribbon ribbon--glass glass">
        <Marquee
          className="ribbon__track ribbon__track--rev"
          items={secondary.map((t, i) => (
            <Emph key={i} text={t} />
          ))}
        />
      </div>
    </section>
  );
}
