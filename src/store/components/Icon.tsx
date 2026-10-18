/** Ícono del sprite de la tienda (<Sprite /> en el layout): <Icon name="bag" /> */
export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <svg className={`icon${className ? ` ${className}` : ''}`} aria-hidden="true" focusable="false">
      <use href={`#i-${name}`} />
    </svg>
  );
}

/** Texto con *énfasis*: la parte entre asteriscos va en cursiva elegante. */
export function Emph({ text }: { text: string | null | undefined }) {
  return (
    <>
      {String(text || '')
        .split(/(\*[^*]+\*)/)
        .map((part, i) => (/^\*[^*]+\*$/.test(part) ? <em key={i}>{part.slice(1, -1)}</em> : part))}
    </>
  );
}
