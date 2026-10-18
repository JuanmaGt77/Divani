/** Preguntas frecuentes (Sitio web → Preguntas). La primera aparece abierta. */
import { Icon } from '../../components/Icon';
import { useSettings, useStorefront } from '../../data/storefront';
import { greetingMessage, waLink } from '../../lib/whatsapp';

export default function Faq() {
  const { data, status } = useStorefront();
  const settings = useSettings();
  if (status === 'error' || (data && !data.faq.length)) return null;

  return (
    <section className="section section--linen faq" id="preguntas" data-edit="faq">
      <div className="container faq__grid">
        <div className="faq__intro">
          <p className="eyebrow">Ayuda</p>
          <h2 className="h-2">
            Preguntas <em>frecuentes</em>
          </h2>
          <p className="lead">¿Tienes otra duda? Escríbenos y te respondemos en horario de atención.</p>
          <a
            className="btn btn--outline btn--wa"
            href={waLink(settings, greetingMessage(settings))}
            target="_blank"
            rel="noopener"
          >
            <Icon name="whatsapp" />
            Preguntar por WhatsApp
          </a>
        </div>
        <div className="accordion">
          {data?.faq.map((f, i) => (
            <details key={`${i}-${f.q}`} open={i === 0}>
              <summary>
                {f.q}
                <Icon name="plus" />
              </summary>
              <div className="accordion__body">
                <p style={{ whiteSpace: 'pre-line' }}>{f.a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
