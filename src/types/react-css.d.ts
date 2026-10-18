// Permite variables de CSS en el atributo style: style={{ '--gap': '8px' }}
import 'react';

declare module 'react' {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
