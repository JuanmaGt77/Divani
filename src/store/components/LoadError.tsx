/** Aviso cuando no se pudo cargar el catálogo, con botón para reintentar. */
export function LoadError({
  onRetry,
  message = 'No pudimos cargar las prendas. Revisa tu conexión e inténtalo de nuevo.',
}: {
  onRetry: () => void;
  message?: string;
}) {
  return (
    <div className="shop-error" style={{ gridColumn: '1/-1' }}>
      <p>{message}</p>
      <button className="btn btn--outline btn--sm" type="button" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}
