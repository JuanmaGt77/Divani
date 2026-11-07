/**
 * Listón de satén «Vendido» que cruza la foto de esquina a esquina. Es un SVG para que parezca
 * una cinta de verdad: cae con una curva suave, el brillo sigue la tela y proyecta sombra.
 * Las dimensiones están en una foto de 400 × 500 (4:5) y escalan con la tarjeta.
 */
import { useId } from 'react';

/** Curva suave en «S» que pasa por el centro y sale por las dos esquinas. */
const CURVA = 'M-50,-62 C62,70 148,196 200,250 S338,430 450,562';
const ANCHO = 50;

export function SoldRibbon() {
  const id = useId();
  const curva = `${id}-curva`;
  const tela = `${id}-tela`;
  const brillo = `${id}-brillo`;
  return (
    <svg className="card__sold" viewBox="0 0 400 500" role="img" aria-label="Vendido">
      <defs>
        <path id={curva} d={CURVA} />
        {/* A lo ancho: orillas tejidas algo más claras y el centro hundido */}
        <linearGradient id={tela} gradientUnits="userSpaceOnUse" x1="179" y1="267" x2="221" y2="233">
          <stop offset="0" stopColor="#403a35" />
          <stop offset="0.1" stopColor="#1c1917" />
          <stop offset="0.42" stopColor="#100e0d" />
          <stop offset="0.58" stopColor="#262220" />
          <stop offset="0.9" stopColor="#141211" />
          <stop offset="1" stopColor="#38322e" />
        </linearGradient>
        {/* A lo largo: los reflejos del satén donde la cinta se curva */}
        <linearGradient id={brillo} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="400" y2="500">
          <stop offset="0.04" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.17" stopColor="#fff" stopOpacity="0.2" />
          <stop offset="0.3" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.68" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.82" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="0.96" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g fill="none">
        <use href={`#${curva}`} stroke={`url(#${tela})`} strokeWidth={ANCHO} />
        <use href={`#${curva}`} stroke={`url(#${brillo})`} strokeWidth={ANCHO} />
        {/* Costura fina junto a cada orilla */}
        <use
          href={`#${curva}`}
          transform="translate(17.2 -13.8)"
          stroke="#f6f1e8"
          strokeOpacity="0.28"
          strokeWidth="0.9"
          strokeDasharray="5 3.5"
        />
        <use
          href={`#${curva}`}
          transform="translate(-17.2 13.8)"
          stroke="#f6f1e8"
          strokeOpacity="0.28"
          strokeWidth="0.9"
          strokeDasharray="5 3.5"
        />
      </g>
      <text className="card__sold-text" dy="0.34em">
        <textPath href={`#${curva}`} startOffset="50%" textAnchor="middle">
          VENDIDO
        </textPath>
      </text>
    </svg>
  );
}
